/* Savage Lane — Guide Link Guard
   Purpose: Hide any /guides/*.html link that 404s, so Buyers/Sellers only show real guides.
   Usage: Add <script src="/js/guide-link-guard.js" defer></script> before </body> on buyers.html and sellers.html.
*/
(function () {
  // Concurrency limiter for fetches
  function pLimit(limit) {
    let active = 0, queue = [];
    const next = () => {
      if (active >= limit || queue.length === 0) return;
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn().then(resolve, reject).finally(() => {
        active--;
        next();
      });
    };
    return (fn) => new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  }

  function isGuideHref(href) {
    try {
      const u = new URL(href, location.origin);
      return u.pathname.startsWith("/guides/") && u.pathname.endsWith(".html");
    } catch {
      return false;
    }
  }

  function closestLI(el) {
    while (el && el !== document.body) {
      if (el.tagName === "LI") return el;
      el = el.parentElement;
    }
    return null;
  }

  function pruneEmptyCards() {
    // Remove cards whose <ul> is now empty after hiding 404 items
    document.querySelectorAll(".card ul").forEach((ul) => {
      const visibleItems = Array.from(ul.children).filter(
        (li) => li.nodeType === 1 && li.offsetParent !== null
      );
      if (visibleItems.length === 0) {
        const card = ul.closest(".card");
        if (card) card.style.display = "none";
      }
    });
  }

  function annotateIfAnyHidden(hiddenCount) {
    if (!hiddenCount) return;
    // Optionally annotate the page that some topics are tailored to your area.
    // Keep it subtle and invisible if nothing was hidden.
    const note = document.createElement("span");
    note.className = "guide-prune-note";
    note.style.cssText = "position:absolute;left:-9999px;opacity:0";
    note.textContent = `${hiddenCount} unavailable guide link${hiddenCount > 1 ? "s" : ""} hidden.`;
    document.body.appendChild(note);
  }

  async function checkLink(a, limit) {
    const href = a.getAttribute("href");
    if (!href || !isGuideHref(href)) return { hidden: false };
    const run = () =>
      fetch(new URL(href, location.origin).toString(), {
        // HEAD is ideal, but some CDNs don’t allow it; fall back to GET if needed
        method: "HEAD",
        redirect: "follow",
        cache: "no-store",
      })
        .catch(() => ({ ok: false }));

    // Try HEAD, then GET fallback if HEAD is blocked
    let res = await limit(run);
    if (!res || res.status === 405 || res.status === 501) {
      res = await limit(() =>
        fetch(new URL(href, location.origin).toString(), {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          headers: { Accept: "text/html" },
        }).catch(() => ({ ok: false }))
      );
    }

    if (!res || !res.ok) {
      const li = closestLI(a);
      if (li) {
        li.style.display = "none";
        li.setAttribute("aria-hidden", "true");
      } else {
        a.style.display = "none";
        a.setAttribute("aria-hidden", "true");
      }
      return { hidden: true };
    }
    return { hidden: false };
  }

  function init() {
    // Only run on Buyers/Sellers hubs to avoid touching article pages
    const isHub = document.body.classList.contains("buyers") || document.body.classList.contains("sellers");
    if (!isHub) return;

    // Target lists inside cards
    const links = Array.from(
      document.querySelectorAll(".card ul li a[href], .card a[href]")
    ).filter((a) => isGuideHref(a.getAttribute("href")));

    if (links.length === 0) return;

    const limit = pLimit(6); // reasonable concurrency
    let hiddenCount = 0;

    Promise.all(
      links.map((a) =>
        checkLink(a, limit).then((r) => {
          if (r.hidden) hiddenCount++;
        })
      )
    ).then(() => {
      pruneEmptyCards();
      annotateIfAnyHidden(hiddenCount);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
