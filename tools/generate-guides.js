/**
 * Savage Lane — Auto-generate Guides pages from the /guides folder
 *
 * What this does (run locally before deploy or in CI):
 * 1) Scans /guides for *.html files (skips index.html, guide.css, fragments)
 * 2) Extracts a human title from <h1> or <title>, falls back to filename
 * 3) Categorizes each guide by checking whether buyers.html or sellers.html link to it
 *    - If found in buyers.html -> “Buyer guides”
 *    - If found in sellers.html -> “Seller guides”
 *    - Else -> “Other guides”
 *    - Optional overrides via /tools/guide-categories.json (filenames only)
 *    - Optional excludes via /tools/guide-categories.json (exclude array, filenames only)
 * 4) Rebuilds /sitemap.html (full file) with three sections + “Core Pages”
 * 5) Rebuilds /guides/index.html (Explore) using the same sections and live search
 *
 * Usage:
 *   node tools/generate-guides.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const GUIDES_DIR = path.join(ROOT, "guides");
const OUT_SITEMAP = path.join(ROOT, "sitemap.html");
const OUT_EXPLORE = path.join(ROOT, "guides", "index.html");

function guidesDirExists() {
  try {
    return fs.existsSync(GUIDES_DIR) && fs.statSync(GUIDES_DIR).isDirectory();
  } catch {
    return false;
  }
}


/**
 * Optional configuration: /tools/guide-categories.json
 * Shape:
 * {
 *   "buyers":  ["file-a.html","file-b.html"],
 *   "sellers": ["file-c.html"],
 *   "exclude": ["file-x.html","file-y.html"]
 * }
 */
function loadGuideConfig(rootDir) {
  const configPath = path.join(rootDir, "tools", "guide-categories.json");

  const categoryMap = {};
  const excludeSet = new Set();

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const data = JSON.parse(raw);

    (data.buyers || []).forEach((n) => {
      const k = String(n || "").trim();
      if (k) categoryMap[k] = "buyers";
    });

    (data.sellers || []).forEach((n) => {
      const k = String(n || "").trim();
      if (k) categoryMap[k] = "sellers";
    });

    (data.exclude || []).forEach((n) => {
      const k = String(n || "").trim();
      if (k) excludeSet.add(k);
    });

    const totalCats = Object.keys(categoryMap).length;
    const totalEx = excludeSet.size;

    console.log(`• Loaded tools/guide-categories.json (categories:${totalCats} exclude:${totalEx})`);
  } catch {
    // optional file, ignore if missing or invalid
  }

  return { categoryMap, excludeSet };
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function listGuideFiles(excludeSet) {
  if (!guidesDirExists()) return [];

  const all = fs
    .readdirSync(GUIDES_DIR, { withFileTypes: true })

    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((n) => {
      if (!n.endsWith(".html")) return false;
      if (n === "index.html") return false;
      if (n === "guide.css") return false;
      if (n.startsWith("_")) return false;
      if (n.includes("template")) return false;
      if (excludeSet && excludeSet.has(n)) return false;
      return true;
    });

  return all.sort((a, b) => a.localeCompare(b));
}

function extractTitle(html, fallback) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1 && h1[1]) return cleanText(h1[1]);

  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t && t[1]) return cleanText(t[1]).replace(/\s*\|\s*Savage Lane\s*$/i, "");

  return fallback.replace(/[-_]/g, " ").replace(/\.html$/i, "").trim();
}

function cleanText(s) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function collectLinks(html) {
  const links = new Set();
  const rx = /href="([^"]+)"/gi;
  let m;
  while ((m = rx.exec(html))) links.add(m[1]);
  return links;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function liList(items) {
  return items
    .map((x) => `          <li><a href="${x.href}">${escapeHtml(x.title)}</a></li>`)
    .join("\n");
}

const buyersHTML = read(path.join(ROOT, "buyers.html"));
const sellersHTML = read(path.join(ROOT, "sellers.html"));
const buyersLinks = collectLinks(buyersHTML);
const sellersLinks = collectLinks(sellersHTML);

const { categoryMap, excludeSet } = loadGuideConfig(ROOT);

const files = listGuideFiles(excludeSet);

let appliedOverrideCount = 0;

const catalog = files.map((fname) => {
  const filePath = path.join(GUIDES_DIR, fname);
  const html = read(filePath);
  const href = `/guides/${fname}`;
  const title = extractTitle(html, fname);

  let category = categoryMap[fname] || "other";
  if (categoryMap[fname]) appliedOverrideCount++;

  if (category === "other") {
    const onBuyers = buyersLinks.has(href);
    const onSellers = sellersLinks.has(href);

    if (onBuyers && !onSellers) category = "buyers";
    else if (onSellers && !onBuyers) category = "sellers";
    else category = "other";
  }

  return { href, title, category };
});

if (appliedOverrideCount) console.log(`• Applied category overrides to ${appliedOverrideCount} guide(s)`);
if (excludeSet.size) console.log(`• Excluded ${excludeSet.size} guide(s) via config`);

const buyers = catalog.filter((x) => x.category === "buyers");
const sellers = catalog.filter((x) => x.category === "sellers");
const others = catalog.filter((x) => x.category === "other");

const updated = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

/*
  Canonical choice:
  Keep /concierge.html as the single indexed intake page.
  Do not list /realtor.html here, it should be an alias or redirect to avoid duplicate indexing.
*/
const CORE_PAGES = [
  { href: "/", label: "Home" },
  { href: "/buyers.html", label: "Buyer Resource Center" },
  { href: "/sellers.html", label: "Seller Resource Center" },
  { href: "/concierge.html", label: "Home Match Concierge" },
  { href: "/privacy.html", label: "Privacy Policy" },
  { href: "/sitemap.xml", label: "XML Sitemap", note: "(for search engines)" },
];

// ===================== Render sitemap.html =====================
const sitemapHTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Site Map | Savage Lane</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Explore all pages on Savage Lane including buyer guides, seller guides, and the Home Match Concierge referral program." />
  <link rel="canonical" href="https://savagelane.com/sitemap.html" />
  <meta name="robots" content="index,follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon.png" />

  <meta property="og:title" content="Site Map | Savage Lane" />
  <meta property="og:description" content="Browse all Savage Lane resources and guides for buyers and sellers." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://savagelane.com/sitemap.html" />
  <meta property="og:image" content="https://savagelane.com/images/default-og.png" />
  <meta name="twitter:card" content="summary_large_image" />

  <link rel="stylesheet" href="/css/style.css" />
  <style>
    .hero{border-radius:24px;padding:28px;box-shadow:var(--shadow);background:linear-gradient(180deg,#fff 0%,#fbfeff 100%);border:1px solid rgba(0,0,0,.06)}
    .grid{display:grid;grid-template-columns:1fr;gap:18px}
    @media(min-width:1000px){.grid-2{grid-template-columns:1fr 1fr}}
    .card{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:16px;padding:18px;box-shadow:var(--shadow)}
    ul{list-style:none;margin:8px 0 0;padding-left:0}
    li{margin:6px 0}
    .note{font-size:.95rem;color:var(--muted);margin-top:8px}
  </style>
</head>
<body>
  <div class="nav-wrap">
    <div class="shell">
      <nav class="main" aria-label="Primary">
        <a class="brand" href="/" aria-label="Savage Lane Home">
          <img src="/images/savage-lane-logo.png" alt="Savage Lane logo"><span>Savage Lane</span>
        </a>
        <div class="links">
          <a class="btn sky" href="/buyers.html">Buyers</a>
          <a class="btn coral" href="/sellers.html">Sellers</a>
          <a class="btn ghost" href="/guides/index.html">Explore</a>
          <a class="btn primary" href="/concierge.html">Home Match Concierge</a>
        </div>
      </nav>
    </div>
  </div>

  <div class="container" style="max-width:1100px;margin:0 auto;padding:20px">
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a><span class="sep" aria-hidden="true">›</span><span>Site Map</span>
    </nav>

    <section class="hero">
      <h1>Site Map</h1>
      <p class="meta">Browse all Savage Lane pages and guides. Last updated: ${updated}.</p>
    </section>

    <section class="grid grid-2" style="margin-top:18px">
      ${catalog.length ? `
      <div class="card" id="buyers">
        <h2>Buyer guides</h2>
        <ul>
${liList(buyers)}
        </ul>
      </div>
      ` : ``}


      ${catalog.length ? `
      <div class="card" id="sellers">
        <h2>Seller guides</h2>
        <ul>
${liList(sellers)}
        </ul>
      </div>

      <div class="card" style="grid-column:1/-1" id="other-guides">
        <h2>Other guides</h2>
        <ul>
${liList(others)}
        </ul>
      </div>
      ` : ``}


      <div class="card" style="grid-column:1/-1">
        <h2>Core Pages</h2>
        <ul>
${CORE_PAGES.map(p => {
  if (p.note) return `          <li><a href="${p.href}">${escapeHtml(p.label)}</a> <span class="note">${escapeHtml(p.note)}</span></li>`;
  return `          <li><a href="${p.href}">${escapeHtml(p.label)}</a></li>`;
}).join("\n")}
        </ul>
      </div>
    </section>
  </div>

  <footer>
    <div class="shell" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>© <span id="y"></span> Savage Lane</div>
      <div class="links">
        <a href="/buyers.html">Buyers</a>
        <span aria-hidden="true"> • </span>
        <a href="/sellers.html">Sellers</a>
        <span aria-hidden="true"> • </span>
        <a href="/concierge.html">Concierge</a>
        <span aria-hidden="true"> • </span>
        <a href="/privacy.html">Privacy</a>
      </div>
    </div>
  </footer>

  <script>document.getElementById("y").textContent = new Date().getFullYear();</script>
  <script src="/js/asksavvy.js" defer></script>
</body>
</html>`;

// ===================== Render guides/index.html (Explore) =====================
const exploreHTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Explore Guides | Savage Lane</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Explore buyer and seller guides, checklists, and how tos from Savage Lane." />
  <link rel="canonical" href="https://savagelane.com/guides/index.html" />
  <link rel="icon" href="/images/favicon.png" type="image/png" sizes="32x32" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Explore Guides | Savage Lane" />
  <meta property="og:description" content="Browse every guide on Savage Lane and find quick answers." />
  <meta property="og:image" content="https://savagelane.com/images/default-og.png" />
  <link rel="stylesheet" href="/css/style.css" />
  <style>
    .hero{border-radius:24px;padding:24px;box-shadow:var(--shadow);background:linear-gradient(180deg,#fff 0%,#fbfeff 100%);border:1px solid rgba(0,0,0,.06)}
    .search{display:flex;gap:8px;margin-top:12px}
    .search input{flex:1;padding:12px 14px;border-radius:12px;border:1px solid #dfe6ff;box-shadow:var(--shadow)}
    .card{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:16px;padding:18px;box-shadow:var(--shadow)}
    .grid{display:grid;grid-template-columns:1fr;gap:18px}
    @media(min-width:900px){.grid-2{grid-template-columns:1fr 1fr}}
    ul{list-style:none;margin:8px 0 0;padding-left:0}
    li{margin:6px 0}
    mark{background:rgba(255,235,59,.45);border-radius:4px;padding:0 2px}
  </style>
</head>
<body>
  <div class="nav-wrap">
    <div class="shell">
      <nav class="main" aria-label="Primary">
        <a class="brand" href="/" aria-label="Savage Lane Home">
          <img src="/images/savage-lane-logo.png" alt="Savage Lane logo"><span>Savage Lane</span>
        </a>
        <div class="links">
          <a class="btn sky" href="/buyers.html">Buyers</a>
          <a class="btn coral" href="/sellers.html">Sellers</a>
          <a class="btn primary" href="/concierge.html">Home Match Concierge</a>
        </div>
      </nav>
    </div>
  </div>

  <div class="shell" style="max-width:1100px;padding:20px">
    <section class="hero">
      <h1>Explore all guides</h1>
      <p class="muted" style="margin:6px 0 0">Smart, plain English answers for buyers and sellers. Start typing to filter. We match on any word in the title.</p>
      <div class="search">
        <input id="q" type="search" placeholder="Search guides (buyers, appraisal, 1031, pre approval…)" aria-label="Search guides">
      </div>
    </section>

    <section class="grid grid-2" style="margin-top:18px">
      <div class="card">
        <h2>Buyer guides</h2>
        <ul id="buyers-list">
${liList(buyers)}
        </ul>
      </div>

      <div class="card">
        <h2>Seller guides</h2>
        <ul id="sellers-list">
${liList(sellers)}
        </ul>
      </div>

      <div class="card" style="grid-column:1/-1">
        <h2>Other guides</h2>
        <ul id="other-list">
${liList(others)}
        </ul>
      </div>
    </section>
  </div>

  <footer>
    <div class="shell" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>© <span id="y"></span> Savage Lane</div>
      <div class="links">
        <a href="/buyers.html">Buyers</a>
        <span aria-hidden="true"> • </span>
        <a href="/sellers.html">Sellers</a>
        <span aria-hidden="true"> • </span>
        <a href="/concierge.html">Concierge</a>
      </div>
    </div>
  </footer>

  <script>
    document.getElementById('y').textContent = new Date().getFullYear();
    const q = document.getElementById('q');

    function filterList(ul, terms){
      const items = ul.querySelectorAll('li');
      items.forEach(li => {
        const a = li.querySelector('a');
        const text = a.textContent.toLowerCase();
        const hit = terms.every(t => text.includes(t));
        li.style.display = hit ? '' : 'none';

        a.innerHTML = a.textContent;
        if (terms.length && hit){
          let html = a.textContent;
          terms.forEach(t=>{
            const escaped = t.replace(/[\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\]/g, '\\\\$&');
            const rx = new RegExp('(' + escaped + ')', 'ig');
            html = html.replace(rx, '<mark>$1</mark>');
          });
          a.innerHTML = html;
        }
      });
    }

    q.addEventListener('input', () => {
      const terms = q.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);
      ['buyers-list','sellers-list','other-list'].forEach(id=>{
        const ul = document.getElementById(id);
        if (ul) filterList(ul, terms);
      });
    });
  </script>

  <script src="/js/asksavvy.js" defer></script>
</body>
</html>`;

write(OUT_SITEMAP, sitemapHTML);
console.log(`✓ Generated ${path.relative(ROOT, OUT_SITEMAP)}`);

if (guidesDirExists()) {
  write(OUT_EXPLORE, exploreHTML);
  console.log(`✓ Generated ${path.relative(ROOT, OUT_EXPLORE)}`);
} else {
  console.log("• Skipped guides/index.html because /guides does not exist");
}

console.log(`Guides found: ${catalog.length} (buyers:${buyers.length} sellers:${sellers.length} other:${others.length})`);
