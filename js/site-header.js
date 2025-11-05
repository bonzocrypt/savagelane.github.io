(function () {
  const mount = document.getElementById('site-header');
  if (!mount) return;

  // Load the shared header partial
  fetch('/partials/header.html', { credentials: 'same-origin' })
    .then(function (res) { return res.text(); })
    .then(function (html) {
      mount.innerHTML = html;

      // Active link highlight
      try {
        const path = location.pathname.replace(/\/$/, '');
        const links = mount.querySelectorAll('nav a');
        links.forEach(function (a) {
          const href = a.getAttribute('href').replace(/\/$/, '');
          if (href && href === path) a.setAttribute('aria-current', 'page');
        });
      } catch (e) {}

      // Ripple-on-click effect
      const addRipple = function (btn) {
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.addEventListener('click', function (e) {
          const ripple = document.createElement('span');
          ripple.className = 'ripple';
          const rect = btn.getBoundingClientRect();
          const size = Math.max(rect.width, rect.height);
          ripple.style.width = ripple.style.height = size + 'px';
          ripple.style.left = e.clientX - rect.left - size / 2 + 'px';
          ripple.style.top = e.clientY - rect.top - size / 2 + 'px';
          btn.appendChild(ripple);
          setTimeout(() => ripple.remove(), 600);
        });
      };

      mount.querySelectorAll('.btn').forEach(addRipple);

      // Inject ripple style once
      if (!document.getElementById('ripple-style')) {
        const style = document.createElement('style');
        style.id = 'ripple-style';
        style.textContent = `
          .btn .ripple {
            position:absolute;
            border-radius:50%;
            transform:scale(0);
            animation:ripple .6s linear;
            background:rgba(255,255,255,.4);
            pointer-events:none;
            z-index:1;
          }
          @keyframes ripple {
            to { transform:scale(3.2); opacity:0; }
          }
        `;
        document.head.appendChild(style);
      }
    })
    .catch(function () {
      // Fallback inline header if partial fails
      mount.innerHTML =
        '<div class="shell nav"><a class="brand" href="/"><img src="/images/savage-lane-logo.png" alt="Savage Lane logo"><h1>Savage Lane</h1></a><nav class="links"><a class="btn sky" href="/buyers.html">Buyers</a><a class="btn coral" href="/sellers.html">Sellers</a><a class="btn ghost" href="/guides/index.html">Explore</a><a class="btn primary" href="/concierge.html">Home Match Concierge</a></nav></div>';
    });
})();
