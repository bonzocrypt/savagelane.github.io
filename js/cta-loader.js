document.addEventListener("DOMContentLoaded", function () {
  // Support one or many mounts on a page
  var mounts = document.querySelectorAll(".cta-mount");
  if (!mounts.length) return;

  // Hide all mounts until content loads
  mounts.forEach(function(m){ m.style.display = "none"; });

  // Candidate paths for static sites served from subfolders
  var sources = [
    "/includes/cta.html",          // absolute from site root
    "../includes/cta.html",        // relative when page is under /guides/
    "includes/cta.html"            // safety fallback
  ];

  function tryFetch(pathIndex){
    if (pathIndex >= sources.length) {
      // If none worked, remove empty mounts to avoid blank space
      mounts.forEach(function(m){
        if (m && m.parentNode) m.parentNode.removeChild(m);
      });
      console.warn("[CTA] Failed to load CTA include from any known path:", sources);
      return;
    }

    var url = sources[pathIndex] + "?v=" + Date.now(); // bust cache on deploys
    fetch(url, { cache: "no-store" })
      .then(function(r){
        if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
        return r.text();
      })
      .then(function(html){
        mounts.forEach(function(m){
          m.innerHTML = html;
          m.style.display = "block";
          m.classList.add("loaded");
        });
        console.info("[CTA] Loaded include from:", url);
      })
      .catch(function(err){
        console.warn("[CTA] Include load failed, trying next path:", err.message);
        tryFetch(pathIndex + 1);
      });
  }

  tryFetch(0);
});
