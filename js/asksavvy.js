/* AskSavvy sitewide injector
   Drop-in: <script src="/js/asksavvy.js" defer></script> before </body>.
   Adds a branded floating chat bubble and a modal Q&A. No frameworks required.
*/
(function () {
  const AS_ENDPOINT = "https://us-central1-savagelane-ai.cloudfunctions.net/realEstateAnswers";

  // Prevent double init
  if (window.__asksavvyLoaded) return;
  window.__asksavvyLoaded = true;

  // ---------------- CSS ----------------
  const css = `
  .asv-hidden{display:none!important}

  /* Page padding so the FAB does not cover content on small screens */
  .asv-pad{ padding-bottom: 92px; }
  @media (min-width: 900px){ .asv-pad{ padding-bottom: 0; } }

  /* Floating chat bubble */
  .asv-fab{
    position:fixed;
    right:20px;
    bottom:20px;
    display:inline-flex;
    align-items:center;
    gap:10px;
    border:0;
    cursor:pointer;
    border-radius:18px;
    background:#6d28d9;
    color:#fff;
    font-weight:800;
    font-size:15px;
    line-height:1;
    padding:12px 14px 12px 12px;
    box-shadow:0 14px 32px rgba(0,0,0,.28);
    z-index:2147483647;
    transition:transform .15s ease, box-shadow .15s ease, background .15s ease;
  }
  .asv-fab:hover{ background:#5b21b6; box-shadow:0 18px 40px rgba(0,0,0,.32) }
  .asv-fab:active{ transform:scale(.98) }

  /* Speech bubble tail */
  .asv-fab::after{
    content:"";
    position:absolute;
    right:16px;
    bottom:-6px;
    width:0;height:0;
    border-left:8px solid transparent;
    border-right:8px solid transparent;
    border-top:8px solid #6d28d9;
    transition:border-top-color .15s ease;
  }
  .asv-fab:hover::after{ border-top-color:#5b21b6 }

  /* Optional dock to left */
  .asv-left{ left:20px; right:auto; }
  .asv-top{ top:20px; bottom:auto; }

  /* Agent avatar circle */
  .asv-agent{
    width:28px; height:28px;
    border-radius:9999px;
    background:#fff;
    color:#6d28d9;
    display:grid; place-items:center;
    font-size:18px; font-weight:900;
    box-shadow:0 6px 16px rgba(0,0,0,.18);
    flex:0 0 28px;
  }

  /* Label and small hint */
  .asv-text{ display:flex; flex-direction:column; align-items:flex-start; }
  .asv-title{ font-weight:900; letter-spacing:.2px }
  .asv-hint{ font-weight:700; opacity:.9; font-size:12px; margin-top:2px }

  /* Make the bubble narrower on very small screens */
  @media (max-width:420px){
    .asv-fab{ font-size:14px; padding:10px 12px 10px 10px }
    .asv-agent{ width:26px; height:26px; font-size:16px }
    .asv-hint{ display:none }
  }

  /* Backdrop and modal */
  .asv-backdrop{
    position:fixed; inset:0; background:rgba(0,0,0,.55);
    align-items:center; justify-content:center; padding:20px; z-index:2147483646;
  }
  .asv-backdrop[aria-hidden="true"]{ display:none; }
  .asv-backdrop[aria-hidden="false"]{ display:flex; }

  .asv-modal{
    width:min(100%,560px);
    max-height:90vh;
    background:#fff; color:#111;
    border-radius:16px; overflow:hidden;
    box-shadow:0 18px 40px rgba(0,0,0,.28);
    display:flex; flex-direction:column;
  }
  .asv-head{
    display:flex; align-items:center; justify-content:space-between; gap:8px;
    padding:12px 14px; background:#ede9fe; color:#4c1d95; font-weight:900;
  }
  .asv-close{
    appearance:none; background:#fff; border:0; border-radius:10px;
    padding:6px 10px; font-weight:800; cursor:pointer;
  }
  .asv-body{ padding:14px; overflow:auto }
  .asv-foot{ padding:10px 14px; background:#fafafa; color:#555; font-size:.95rem; border-top:1px solid #eee }
  .asv-input{
    width:100%; border:1px solid #ddd; border-radius:10px; padding:10px; margin:6px 0 10px; font-size:1rem; resize:vertical
  }
  .asv-btn{
    width:100%; background:#6d28d9; color:#fff; border:0; border-radius:10px; padding:10px 12px; font-weight:800; cursor:pointer
  }
  .asv-btn[disabled]{ opacity:.6; cursor:not-allowed }
  .asv-progress{ height:6px; background:#e5e7eb; border-radius:9999px; overflow:hidden; margin-top:10px; display:none }
  .asv-progress > span{ display:block; height:100%; background:#8b5cf6; width:8%; transition:width .15s ease }
  .asv-result{ margin-top:12px; background:#f9fafb; border:1px solid #eee; border-radius:10px; padding:10px; font-size:.95rem; display:none }

  /* Drag affordance cursor while dragging */
  .asv-dragging{ cursor:grabbing!important }
  `;

  const style = document.createElement("style");
  style.setAttribute("data-asksavvy", "true");
  style.textContent = css;
  document.head.appendChild(style);

  // ---------------- Markup ----------------
  const fab = document.createElement("button");
  fab.className = "asv-fab";
  fab.id = "asvFab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Open AskSavvy");
  fab.setAttribute("title", "AskSavvy: Real estate questions");

  // Realtor avatar with SOLD sign vibe using pure text and emoji
  fab.innerHTML = `
    <span class="asv-agent" aria-hidden="true">🏠</span>
    <span class="asv-text">
      <span class="asv-title">Real Estate Questions</span>
      <span class="asv-hint">AskSavvy can help</span>
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
      <label for="asvQ" style="font-weight:700;display:block;margin-bottom:6px">Ask a question</label>
      <textarea id="asvQ" class="asv-input" rows="3" placeholder="Ask about buying or selling a home"></textarea>
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
  document.body.classList.add("asv-pad");

  // ---------------- Modal behavior ----------------
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

  // ---------------- Smart placement and dragging ----------------

  // Restore last position if the user dragged it
  try {
    const saved = JSON.parse(localStorage.getItem("asvPos") || "null");
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
      // Switch to absolute left/top coords
      fab.style.left = `${saved.x}px`;
      fab.style.top = `${saved.y}px`;
      fab.style.right = "auto";
      fab.style.bottom = "auto";
    }
  } catch(_) {}

  // Edge aware auto dock: if it overlaps the footer, move it to left bottom
  try {
    const footer = document.querySelector("footer");
    if (footer && "IntersectionObserver" in window) {
      const obs = new IntersectionObserver((entries) => {
        const v = entries[0];
        if (!v) return;
        const rect = fab.getBoundingClientRect();
        const overlap = v.isIntersecting && rect.bottom > v.boundingClientRect.top - 12;
        if (overlap) {
          // Dock left, keep bottom
          fab.classList.add("asv-left");
          fab.classList.remove("asv-top");
        }
      }, { root: null, threshold: 0, rootMargin: "0px 0px -20% 0px" });
      obs.observe(footer);
    }
  } catch(_) {}

  // Draggable FAB with bounds and persistence
  (function makeDraggable(el){
    let dragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    function onDown(e){
      // Allow drag with left click or touch
      const p = ("touches" in e) ? e.touches[0] : e;
      dragging = true;
      document.body.classList.add("asv-dragging");

      const rect = el.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      startX = p.clientX;
      startY = p.clientY;

      // Switch to left/top positioning for free drag
      el.style.left = `${startLeft}px`;
      el.style.top = `${startTop}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";

      window.addEventListener("mousemove", onMove);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchend", onUp);
    }

    function onMove(e){
      if (!dragging) return;
      if ("touches" in e) e.preventDefault();
      const p = ("touches" in e) ? e.touches[0] : e;

      const dx = p.clientX - startX;
      const dy = p.clientY - startY;

      let nextLeft = startLeft + dx;
      let nextTop  = startTop + dy;

      // Keep inside viewport
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      nextLeft = Math.max(8, Math.min(vw - w - 8, nextLeft));
      nextTop  = Math.max(8, Math.min(vh - h - 8, nextTop));

      el.style.left = `${nextLeft}px`;
      el.style.top  = `${nextTop}px`;
    }

    function onUp(){
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("asv-dragging");

      // Persist position
      const rect = el.getBoundingClientRect();
      try {
        localStorage.setItem("asvPos", JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
      } catch(_) {}

      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    }

    el.addEventListener("mousedown", onDown);
    el.addEventListener("touchstart", onDown, { passive: true });
  })(fab);

  // Optional: reduce hint after a short delay on tiny screens
  try {
    const mq = window.matchMedia("(max-width: 420px)");
    if (mq.matches) {
      setTimeout(() => {
        const hint = fab.querySelector(".asv-hint");
        if (hint) hint.classList.add("asv-hidden");
      }, 4000);
    }
  } catch(_) {}

})();

// Auto CTA under concierge button removed on request
// Guides will now show only the button that is in the HTML
