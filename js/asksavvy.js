/* AskSavvy sitewide injector
   Usage (next move): add <script src="/js/asksavvy.js" defer></script> before </body>.
   The script injects a compact launcher + modal and wires up your Cloud Function endpoint.
*/
(function () {
  const AS_ENDPOINT = "https://us-central1-savagelane-ai.cloudfunctions.net/realEstateAnswers";
  const ID = (s) => document.getElementById(s);

  // Prevent double init
  if (window.__asksavvyLoaded) return;
  window.__asksavvyLoaded = true;

  // --------- CSS (scoped and minimal) ----------
  const css = `
  .asv-hidden{display:none!important}

  /* Add gentle bottom padding on small screens so FAB never covers content */
  .asv-pad{ padding-bottom: 84px; }
  @media (min-width: 900px){
    .asv-pad{ padding-bottom: 0; }
  }

  .asv-fab{
    position:fixed; right:20px; bottom:20px; height:48px; max-width:56vw;
    padding:0 12px; display:flex; gap:8px; align-items:center; border:0; cursor:pointer;
    border-radius:9999px; background:#6d28d9; color:#fff; font-weight:700; font-size:14px; z-index:2147483647;
    box-shadow:0 10px 30px rgba(0,0,0,.25);
  }
  .asv-fab:hover{ background:#5b21b6 }
  .asv-fab__dot{ width:22px; height:22px; border-radius:9999px; background:#fff; color:#6d28d9; display:grid; place-items:center; font-weight:900 }
  .asv-fab__label{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .asv-fab__hint{ font-weight:600; opacity:.9; }
  @media (max-width:480px){ .asv-fab{ height:44px; font-size:13px } .asv-fab__dot{ width:20px; height:20px } }

  .asv-backdrop{
    position:fixed; inset:0; background:rgba(0,0,0,.55);
    align-items:center; justify-content:center; padding:20px; z-index:2147483646;
  }
  /* Backdrop visibility tied to ARIA — prevents intercepting clicks when closed */
  .asv-backdrop[aria-hidden="true"]{ display:none; }
  .asv-backdrop[aria-hidden="false"]{ display:flex; }

  .asv-modal{
    width:min(100%,540px); max-height:90vh; background:#fff; color:#111; border-radius:16px; overflow:hidden;
    box-shadow:0 18px 40px rgba(0,0,0,.25); display:flex; flex-direction:column
  }
  .asv-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 14px; background:#ede9fe; color:#4c1d95; font-weight:800 }
  .asv-close{ appearance:none; background:#fff; border:0; border-radius:10px; padding:6px 10px; font-weight:700; cursor:pointer }
  .asv-body{ padding:14px; overflow:auto }
  .asv-foot{ padding:10px 14px; background:#fafafa; color:#555; font-size:.92rem; border-top:1px solid #eee }
  .asv-input{ width:100%; border:1px solid #ddd; border-radius:10px; padding:10px; margin:6px 0 10px; font-size:1rem; resize:vertical }
  .asv-btn{ width:100%; background:#6d28d9; color:#fff; border:0; border-radius:10px; padding:10px 12px; font-weight:700; cursor:pointer }
  .asv-btn[disabled]{ opacity:.6; cursor:not-allowed }
  .asv-progress{ height:6px; background:#e5e7eb; border-radius:9999px; overflow:hidden; margin-top:10px; display:none }
  .asv-progress > span{ display:block; height:100%; background:#8b5cf6; width:8%; transition:width .15s ease }
  .asv-result{ margin-top:12px; background:#f9fafb; border:1px solid #eee; border-radius:10px; padding:10px; font-size:.95rem; display:none }
  `;

  const style = document.createElement("style");
  style.setAttribute("data-asksavvy", "true");
  style.textContent = css;
  document.head.appendChild(style);

  // --------- Markup injection ----------
  const fab = document.createElement("button");
  fab.className = "asv-fab";
  fab.id = "asvFab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Open AskSavvy");
  fab.setAttribute("title", "AskSavvy: AI guide to buying and selling");
  fab.innerHTML = `
    <span class="asv-fab__dot" aria-hidden="true">?</span>
    <span class="asv-fab__label">
      AskSavvy <span class="asv-fab__hint">• questions welcome</span>
    </span>
  `;

  const backdrop = document.createElement("div");
  backdrop.className = "asv-backdrop";
  backdrop.id = "asvBackdrop";
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-label", "AskSavvy");

  const modal = document.createElement("div");
  modal.className = "asv-modal";
  modal.setAttribute("role", "document");
  modal.innerHTML = `
    <div class="asv-head">
      <div>AskSavvy</div>
      <button class="asv-close" id="asvClose" type="button" aria-label="Close">Close</button>
    </div>
    <div class="asv-body">
      <label for="asvQ" style="font-weight:600;display:block;margin-bottom:6px">Ask a question</label>
      <textarea id="asvQ" class="asv-input" rows="3" placeholder="Ask about buying or selling a home..."></textarea>
      <button id="asvAsk" class="asv-btn" type="button">Ask</button>
      <div class="asv-progress" id="asvProg"><span id="asvProgBar"></span></div>
      <div class="asv-result" id="asvResult"></div>
    </div>
    <div class="asv-foot">
      Educational only. For offers, negotiations, pricing strategy, or contracts, a licensed Realtor handles next steps. We can connect you through Home Match Concierge.
    </div>
  `;
  backdrop.appendChild(modal);

  document.body.appendChild(fab);
  document.body.appendChild(backdrop);
  // Add body padding so FAB won’t overlap important footer/content on small screens
  document.body.classList.add("asv-pad");


  // --------- Behavior ----------
  const closeBtn = modal.querySelector("#asvClose");
  const askBtn = modal.querySelector("#asvAsk");
  const input = modal.querySelector("#asvQ");
  const result = modal.querySelector("#asvResult");
  const prog = modal.querySelector("#asvProg");
  const bar = modal.querySelector("#asvProgBar");

  function open() {
    backdrop.style.display = "flex";
    backdrop.setAttribute("aria-hidden", "false");
    setTimeout(() => input.focus(), 50);
  }
  function close() {
    backdrop.style.display = "none";
    backdrop.setAttribute("aria-hidden", "true");
    result.style.display = "none";
    result.textContent = "";
    input.value = "";
    bar.style.width = "8%";
    prog.style.display = "none";
  }

  fab.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && backdrop.getAttribute("aria-hidden") === "false") close(); });

  async function postQuestion(q) {
    const resp = await fetch(AS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: q })
    });
    return resp.json();
  }

  askBtn.addEventListener("click", async () => {
    const q = String(input.value || "").trim();
    if (!q) { input.focus(); return; }

    askBtn.disabled = true;
    prog.style.display = "block";
    result.style.display = "none";
    result.textContent = "";

    // simple visual progress
    let pct = 8;
    const timer = setInterval(() => { pct = Math.min(100, pct + 3); bar.style.width = pct + "%"; }, 60);

    try {
      const data = await postQuestion(q);
      result.style.display = "block";
      if (data && data.result) {
        result.innerHTML = '<b>AskSavvy:</b><div style="margin-top:6px">' + data.result.replace(/\n/g, "<br>") + "</div>";
      } else if (data && data.error) {
        result.textContent = "Error: " + (data.error.message || JSON.stringify(data.error));
      } else {
        result.textContent = "No response from AskSavvy.";
      }
    } catch (err) {
      result.style.display = "block";
      result.textContent = "Error: " + (err && err.message ? err.message : String(err));
    } finally {
      clearInterval(timer);
      bar.style.width = "100%";
      setTimeout(() => { prog.style.display = "none"; bar.style.width = "8%"; }, 400);
      askBtn.disabled = false;
    }
  });

  // Optional: shrink label on very small screens after a delay so it doesn’t feel busy.
  try {
    const mq = window.matchMedia("(max-width: 420px)");
    if (mq.matches) {
      setTimeout(() => {
        const hint = fab.querySelector(".asv-fab__hint");
        if (hint) hint.classList.add("asv-hidden");
      }, 4000);
    }
  } catch(_) {}
})();
/* ==================== Auto-inject CTA note on guide pages ==================== */
document.addEventListener("DOMContentLoaded", () => {
  // Determine Buyers vs Sellers from the page breadcrumbs
  function getGuideContext() {
    const crumbs = document.querySelector(".sl-breadcrumbs");
    if (crumbs) {
      if (crumbs.querySelector("a[href='/buyers.html']")) return "buyer";
      if (crumbs.querySelector("a[href='/sellers.html']")) return "seller";
    }
    if (location.pathname.endsWith("/buyers.html")) return "buyer";
    if (location.pathname.endsWith("/sellers.html")) return "seller";
    return null;
  }

  const context = getGuideContext();
  if (!context) return;

  const conciergeButtons = document.querySelectorAll("a.btn.primary[href='/concierge.html']");
  if (!conciergeButtons.length) return;

  conciergeButtons.forEach((btn) => {
    // 1) Normalize a per-button wrapper that STACKS content vertically
    let wrapper = btn.closest(".cta-wrap");
    if (!wrapper) {
      // Prefer an existing <p>, otherwise create a div
      const host = btn.closest("p") || btn.parentElement;
      // Create a dedicated wrapper and move the button inside it
      wrapper = document.createElement("div");
      wrapper.className = "cta-wrap";
      wrapper.style.display = "inline-flex";       // keeps inline flow inside flex rows
      wrapper.style.flexDirection = "column";      // stacks button then note
      wrapper.style.alignItems = "flex-start";     // left aligned
      wrapper.style.gap = "6px";
      // Insert wrapper before the button, then move the button in
      host.insertBefore(wrapper, btn);
      wrapper.appendChild(btn);
    }

    // 2) Prevent duplicates for this button
    if (wrapper.querySelector(".cta-note")) return;

    // 3) Build the note text per context
    const note = document.createElement("span");
    note.className = "cta-note";
    note.textContent = (context === "seller")
      ? "Nearby homes like yours are getting strong interest"
      : "Homes in your price range are moving fast right now";

    // 4) Ensure full-width line under the button even inside flex parents
    note.style.display = "block";
    note.style.margin = "0";

    wrapper.appendChild(note);
  });
});
