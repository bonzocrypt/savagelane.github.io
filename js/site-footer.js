(function () {
  // Find the site footer container
  var footerEl = document.getElementById("site-footer");
  if (!footerEl) {
    return;
  }

  // Shared footer HTML for the entire site, matching the home page footer style
  footerEl.innerHTML = ''
    + '<div class="shell" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">'
    + '  <div>© <span id="y"></span> Savage Lane. All rights reserved.</div>'
    + '  <div>'
    + '    <a href="/privacy.html">Privacy</a>'
    + '    <span aria-hidden="true"> • </span>'
    + '    <a href="/sitemap.html">Site Map</a>'
    + '    <span aria-hidden="true"> • </span>'
+ '    <a href="/concierge.html">Home Match Concierge</a>'
+ '    <span aria-hidden="true"> • </span>'

    + '    <a href="/about.html">About</a>'
    + '  </div>'
    + '</div>';

  // Update year (supports both y and year ids so older pages do not break)
  var now = new Date();
  var ySpan = document.getElementById("y");
  if (ySpan) {
    ySpan.textContent = now.getFullYear();
  }
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = now.getFullYear();
  }

  // Optional support for pages that show an effective date (like privacy)
  var effectiveEl = document.getElementById("effective");
  if (effectiveEl && !effectiveEl.textContent) {
    effectiveEl.textContent = now.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }
})();
