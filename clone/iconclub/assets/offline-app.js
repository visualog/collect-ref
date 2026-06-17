const state = {
  library: null,
  q: "",
  categories: new Set(),
  cell: Number(localStorage.getItem("cell") || 88),
  favs: JSON.parse(localStorage.getItem("favs") || "[]"),
  favView: false,
  pop: null,
  selected: null,
  radius: 23,
  size: 1024,
  adjust: {
    gray: false,
    invert: false,
    exposure: 1,
    contrast: 1,
    saturation: 1,
    temp: 0,
    tint: 0,
    hue: 0
  },
  toast: "",
  visibleCount: 160,
  lastRenderedKey: "",
  lastShownIds: "",
  filters: {
    colors: new Set(),
    text: false,
    dimensional: false
  },
  iconMeta: JSON.parse(localStorage.getItem("iconMeta:v1") || "{}")
};

const root = document.querySelector("#root");
let analysisStarted = false;
let analysisDirty = false;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

const svg = {
  search: icon(`<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`),
  close: icon(`<path d="M18 6L6 18M6 6l12 12"/>`),
  grid: icon(`<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`),
  filter: icon(`<path d="M4 5h16"/><path d="M7 12h10"/><path d="M10 19h4"/>`),
  sliders: icon(`<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>`),
  down: icon(`<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>`),
  link: icon(`<path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-2 2"/><path d="M13 18l-1 1a4 4 0 0 1-6-6l2-2"/>`),
  reset: icon(`<path d="M3 3v6h6"/><path d="M3.5 9a9 9 0 1 0 2.2-3.4L3 9"/>`),
  heart: filled => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.5 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`
};

init();

async function init() {
  root.innerHTML = `<div class="boot"><div class="boot-dot"></div>Loading library...</div>`;
  state.library = await fetch("./data/apps.json").then(response => response.json());
  render();
  startIconAnalysis();
}

function render() {
  const apps = visibleApps();
  const shown = apps.slice(0, state.visibleCount);
  const gridKey = [
    state.q,
    [...state.categories].sort().join(","),
    state.favView,
    [...state.filters.colors].sort().join(","),
    state.filters.text,
    state.filters.dimensional,
    state.visibleCount,
    state.cell
  ].join("|");
  const shownIds = shown.map(app => app.id).join(",");
  root.innerHTML = `
    <div class="app">
      <main class="main">
        <section class="hero">
          <div class="hero-inner">
            <h1 class="hero-title">The largest <em>App&nbsp;Store</em><br>icon library</h1>
            <p class="hero-meta mono">${state.library.sourceTotal.toLocaleString()} icons · offline sample ${state.library.total.toLocaleString()}</p>
          </div>
        </section>
        <div class="result-bar">
          <span>${shown.length.toLocaleString()} of ${apps.length.toLocaleString()} icons</span>
        </div>
        <div class="grid" style="--icon:${state.cell}px">
          ${shown.map(appCard).join("")}
        </div>
        ${apps.length ? "" : `<p class="empty">${state.favView ? "No favorites yet — tap the heart on any icon to save it here." : "No icons match."}</p>`}
        ${shown.length < apps.length ? `<div class="scroll-sentinel"><button class="pg" data-action="load-more">Load more</button></div>` : ""}
      </main>
      ${dock()}
      ${state.selected ? drawer(state.selected) : ""}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>`;
  state.lastRenderedKey = gridKey;
  state.lastShownIds = shownIds;
  observeSentinel();
}

function renderSoft() {
  const apps = visibleApps();
  const shown = apps.slice(0, state.visibleCount);
  const gridKey = [
    state.q,
    [...state.categories].sort().join(","),
    state.favView,
    [...state.filters.colors].sort().join(","),
    state.filters.text,
    state.filters.dimensional,
    state.visibleCount,
    state.cell
  ].join("|");
  const shownIds = shown.map(app => app.id).join(",");
  if (gridKey !== state.lastRenderedKey || shownIds !== state.lastShownIds || state.selected || state.toast) {
    render();
    return;
  }
  const app = document.querySelector(".app");
  if (!app) {
    render();
    return;
  }
  const dockNode = app.querySelector(".dock");
  if (dockNode) dockNode.outerHTML = dock();
}

function visibleApps() {
  const source = state.favView ? state.favs : state.library.apps;
  const query = state.q.trim().toLowerCase();
  return source.filter(app => {
    const textMatch = !query || app.name.toLowerCase().includes(query) || app.developer.toLowerCase().includes(query);
    const catMatch = !state.categories.size || state.categories.has(app.category);
    const visualMatch = visualFilterMatch(app);
    return textMatch && catMatch && visualMatch;
  });
}

function visualFilterMatch(app) {
  const meta = state.iconMeta[app.id];
  const hasVisualFilters = state.filters.colors.size || state.filters.text || state.filters.dimensional;
  if (!hasVisualFilters) return true;
  if (!meta) return false;
  if (state.filters.colors.size && !state.filters.colors.has(meta.color)) return false;
  if (state.filters.text && !meta.text) return false;
  if (state.filters.dimensional && !meta.dimensional) return false;
  return true;
}

function appCard(app) {
  const fav = isFav(app.id);
  return `
    <div class="cell" role="button" tabindex="0" title="${escapeAttr(app.name)}" data-open="${app.id}">
      <span class="thumb">
        <img src="${app.icon}" alt="${escapeAttr(app.name)}" loading="lazy">
        <button class="fav-btn ${fav ? "on" : ""}" data-fav="${app.id}" aria-label="Favorite">${svg.heart(fav)}</button>
      </span>
      <span class="cell-name">${escapeHtml(app.name)}</span>
      <span class="cell-cat mono">${escapeHtml(app.category)}</span>
    </div>`;
}

function dock() {
  const count = state.categories.size;
  const visualCount = state.filters.colors.size + Number(state.filters.text) + Number(state.filters.dimensional);
  return `
    <div class="dock">
      ${state.pop ? `<div class="pop-backdrop" data-action="close-pop"></div>` : ""}
      ${state.pop === "cat" ? categoryPop() : ""}
      ${state.pop === "filters" ? filtersPop() : ""}
      ${state.pop === "view" ? viewPop() : ""}
      <button class="dock-fav ${state.favView ? "on" : ""}" data-action="favorites" title="Favorites" aria-label="Favorites">
        ${svg.heart(state.favView)}
        ${state.favs.length ? `<span class="dock-fav-n mono">${state.favs.length}</span>` : ""}
      </button>
      <label class="dock-search">
        ${svg.search}
        <input id="search" placeholder="Search apps, developers..." value="${escapeAttr(state.q)}">
        ${state.q ? `<button type="button" class="clear-q" data-action="clear-search" aria-label="Clear">${svg.close}</button>` : ""}
      </label>
      <button class="dock-cat ${count ? "on" : ""}" data-action="categories">
        ${svg.grid}
        <span class="dock-cat-label">Category</span>
        ${count ? `<span class="badge">${count}</span>` : ""}
        <svg class="chev-i ${state.pop === "cat" ? "up" : ""}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <button class="dock-cat ${visualCount ? "on" : ""}" data-action="filters">
        ${svg.filter}
        <span class="dock-cat-label">Filters</span>
        ${visualCount ? `<span class="badge">${visualCount}</span>` : ""}
        <svg class="chev-i ${state.pop === "filters" ? "up" : ""}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <button class="dock-iconbtn ${state.pop === "view" ? "on" : ""}" data-action="view" title="Icon size" aria-label="Icon size">${svg.sliders}</button>
    </div>`;
}

function categoryPop() {
  return `
    <div class="cat-pop">
      <div class="cat-pop-head">
        <span class="mono-label">Category</span>
        ${state.categories.size ? `<button class="textlink" data-action="clear-categories">Clear</button>` : ""}
      </div>
      <div class="cat-list">
        ${state.library.categories.map(([name, count]) => `
          <button class="chip-row ${state.categories.has(name) ? "on" : ""}" data-cat="${escapeAttr(name)}">
            <span>${escapeHtml(name)}</span>
            <span class="mono dim">${count.toLocaleString()}</span>
          </button>`).join("")}
      </div>
    </div>`;
}

function viewPop() {
  const presets = [
    ["Compact", 64],
    ["Default", 96],
    ["Large", 128],
    ["Preview", 160],
    ["Inspect", 256]
  ];
  return `
    <div class="view-pop">
      <div class="cat-pop-head">
        <span class="mono-label">Icon size</span>
        <span class="mono dim">${state.cell}px</span>
      </div>
      <div class="size-presets">
        ${presets.map(([label, size]) => `<button class="size-preset ${state.cell === size ? "on" : ""}" data-cell-size="${size}">${label}</button>`).join("")}
      </div>
      <div class="view-slider">
        <span class="view-sq" style="width:7px;height:7px"></span>
        <input id="icon-size" type="range" min="48" max="256" step="8" value="${state.cell}">
        <span class="view-sq" style="width:15px;height:15px"></span>
      </div>
    </div>`;
}

function filtersPop() {
  const colors = [
    ["red", "#f04444"],
    ["orange", "#f28a2e"],
    ["yellow", "#f3d33b"],
    ["green", "#36c66f"],
    ["cyan", "#28c7d8"],
    ["blue", "#3478f6"],
    ["purple", "#8e5cf7"],
    ["pink", "#f05ba8"],
    ["mono", "#d8d8df"]
  ];
  const analyzed = Object.keys(state.iconMeta).length;
  return `
    <div class="filter-pop">
      <div class="cat-pop-head">
        <span class="mono-label">Filters</span>
        ${hasActiveVisualFilters() ? `<button class="textlink" data-action="clear-visual-filters">Clear</button>` : ""}
      </div>
      <div class="filter-group">
        <div class="filter-label mono">Color</div>
        <div class="filter-colors">
          ${colors.map(([name, color]) => `
            <button class="filter-swatch ${state.filters.colors.has(name) ? "on" : ""}" data-color="${name}" title="${name}" aria-label="${name}" style="--swatch:${color}"></button>
          `).join("")}
        </div>
      </div>
      <div class="filter-group">
        <button class="chip-row ${state.filters.text ? "on" : ""}" data-action="toggle-text-filter">
          <span>Text</span>
          <span class="mono dim">${countMeta("text").toLocaleString()}</span>
        </button>
        <button class="chip-row ${state.filters.dimensional ? "on" : ""}" data-action="toggle-3d-filter">
          <span>3D</span>
          <span class="mono dim">${countMeta("dimensional").toLocaleString()}</span>
        </button>
      </div>
      <div class="filter-foot mono">${analyzed.toLocaleString()} analyzed</div>
    </div>`;
}

function drawer(app) {
  const fav = isFav(app.id);
  const filter = [
    `brightness(${state.adjust.exposure})`,
    `contrast(${state.adjust.contrast})`,
    `saturate(${state.adjust.saturation})`,
    state.adjust.hue ? `hue-rotate(${state.adjust.hue}deg)` : "",
    state.adjust.gray ? "grayscale(1)" : "",
    state.adjust.invert ? "invert(1)" : ""
  ].filter(Boolean).join(" ");
  return `
    <div class="drawer-scrim" data-action="close-drawer">
      <aside class="drawer">
        <header class="dh">
          <img class="dh-icon" src="${app.icon}" alt="">
          <div class="dh-meta">
            <div class="dh-name" title="${escapeAttr(app.name)}">${escapeHtml(app.name)}</div>
            <div class="dh-dev">${escapeHtml(app.developer)}</div>
            <div class="dh-chips"><span class="chip">Offline</span><span class="chip">${escapeHtml(app.category)}</span></div>
          </div>
          <div class="dh-actions">
            <button class="icon-btn" data-action="reset-adjust" title="Reset all" aria-label="Reset all">${svg.reset}</button>
            <button class="icon-btn ${fav ? "faved" : ""}" data-fav="${app.id}" aria-label="Favorite">${svg.heart(fav)}</button>
            <button class="icon-btn" data-action="close-drawer" aria-label="Close">${svg.close}</button>
          </div>
        </header>
        <div class="drawer-body">
          <section class="preview-sec">
            <div class="stage"><img class="stage-img" src="${app.icon}" alt="${escapeAttr(app.name)}" style="border-radius:${state.radius}%;filter:${filter}"></div>
          </section>
          <section class="d-sec">
            <div class="d-label">Shape <span class="d-val mono" data-drawer-value="shape">${state.radius >= 50 ? "circle" : `${state.radius}%`}</span></div>
            <div class="seg-row">
              ${[[0, "Square"], [16, "Rounded"], [23, "Squircle"], [50, "Circle"]].map(([value, label]) => `<button class="seg ${state.radius === value ? "on" : ""}" data-radius="${value}">${label}</button>`).join("")}
            </div>
            <input id="radius" type="range" min="0" max="50" step="1" value="${state.radius}">
          </section>
          <section class="d-sec">
            <div class="d-label">Adjust</div>
            <div class="adj-list">
              ${switchRow("Grayscale", "gray")}
              ${switchRow("Invert", "invert")}
              ${rangeRow("Exposure", "exposure", .5, 1.5, .02)}
              ${rangeRow("Contrast", "contrast", .5, 1.5, .02)}
              ${rangeRow("Saturation", "saturation", 0, 2, .02)}
              ${rangeRow("Hue", "hue", -180, 180, 1, value => `${Math.round(value)}°`)}
            </div>
          </section>
          <section class="d-sec">
            <div class="d-label">Size <span class="d-val mono" data-drawer-value="size">${state.size}px</span></div>
            <div class="seg-row">
              ${[256, 512, 1024].map(size => `<button class="seg ${state.size === size ? "on" : ""}" data-size="${size}">${size}</button>`).join("")}
            </div>
          </section>
          <section class="d-sec">
            <div class="d-label">Details</div>
            <div class="rows">
              ${row("Category", app.category)}
              ${row("Year", app.year)}
              ${row("Price", app.price ? `$${app.price}` : "Free")}
              ${row("Rating", app.rating ? `${app.rating} · ${app.ratingCount.toLocaleString()}` : null)}
              ${row("Age rating", app.contentRating)}
            </div>
          </section>
        </div>
        <footer class="drawer-foot">
          <div class="foot-row">
            <button class="btn primary" data-action="copy-local">Copy Icon Path</button>
            <button class="foot-icon" data-action="download-custom" title="Download" aria-label="Download">${svg.down}</button>
            <button class="foot-icon" data-action="copy-local" title="Copy image link" aria-label="Copy image link">${svg.link}</button>
          </div>
        </footer>
      </aside>
    </div>`;
}

function row(label, value) {
  return `<div class="row"><span class="row-label">${label}</span><span class="row-value">${value ?? `<span class="dim">—</span>`}</span></div>`;
}

function switchRow(label, key) {
  return `<button type="button" class="sw-row ${state.adjust[key] ? "on" : ""}" data-switch="${key}" role="switch" aria-checked="${state.adjust[key]}"><span>${label}</span><span class="sw-track"><span class="sw-knob"></span></span></button>`;
}

function rangeRow(label, key, min, max, step, format = value => signed(Math.round((value - 1) * 100))) {
  const value = state.adjust[key];
  return `<div class="adj"><span class="adj-label">${label}</span><input type="range" data-adjust="${key}" min="${min}" max="${max}" step="${step}" value="${value}"><span class="adj-val">${format(value)}</span></div>`;
}

document.addEventListener("click", event => {
  const target = event.target.closest("[data-action], [data-open], [data-fav], [data-cat], [data-radius], [data-size], [data-switch], [data-color], [data-cell-size]");
  if (!target) return;
  if (target.classList.contains("drawer-scrim") && event.target.closest(".drawer")) return;
  if (target.dataset.fav) {
    event.stopPropagation();
    const app = findApp(target.dataset.fav);
    if (app) toggleFav(app);
    return;
  }
  if (target.dataset.open) {
    state.selected = findApp(target.dataset.open);
    state.radius = 23;
    state.size = 1024;
    render();
    return;
  }
  if (target.dataset.cat) {
    const name = target.dataset.cat;
    state.categories.has(name) ? state.categories.delete(name) : state.categories.add(name);
    resetVisibleCount();
    render();
    return;
  }
  if (target.dataset.color) {
    const color = target.dataset.color;
    state.filters.colors.has(color) ? state.filters.colors.delete(color) : state.filters.colors.add(color);
    resetVisibleCount();
    render();
    return;
  }
  if (target.dataset.radius) state.radius = Number(target.dataset.radius);
  if (target.dataset.size) state.size = Number(target.dataset.size);
  if (target.dataset.radius || target.dataset.size || target.dataset.switch) {
    if (target.dataset.switch) state.adjust[target.dataset.switch] = !state.adjust[target.dataset.switch];
    updateDrawerControls();
    return;
  }
  if (target.dataset.cellSize) {
    state.cell = Number(target.dataset.cellSize);
    localStorage.setItem("cell", state.cell);
    resetVisibleCount();
    render();
    return;
  }

  const action = target.dataset.action;
  if (action === "categories" || action === "view" || action === "filters") {
    state.pop = state.pop === action.replace("categories", "cat") ? null : action.replace("categories", "cat");
    renderSoft();
    return;
  }
  if (action === "favorites") {
    state.favView = !state.favView;
    resetVisibleCount();
  }
  if (action === "clear-search") {
    state.q = "";
    resetVisibleCount();
  }
  if (action === "clear-categories") {
    state.categories.clear();
    resetVisibleCount();
  }
  if (action === "clear-visual-filters") {
    state.filters.colors.clear();
    state.filters.text = false;
    state.filters.dimensional = false;
    resetVisibleCount();
  }
  if (action === "toggle-text-filter") {
    state.filters.text = !state.filters.text;
    resetVisibleCount();
  }
  if (action === "toggle-3d-filter") {
    state.filters.dimensional = !state.filters.dimensional;
    resetVisibleCount();
  }
  if (action === "load-more") loadMore();
  if (action === "close-pop") state.pop = null;
  if (action === "close-drawer") state.selected = null;
  if (action === "reset-adjust") {
    resetAdjust();
    updateDrawerControls();
    return;
  }
  if (action === "copy-local" && state.selected) copyText(state.selected.icon);
  if (action === "download-custom" && state.selected) downloadCustomIcon(state.selected);
  render();
});

document.addEventListener("input", event => {
  if (event.target.id === "search") {
    state.q = event.target.value;
    resetVisibleCount();
    render();
    const input = document.querySelector("#search");
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }
  if (event.target.id === "icon-size") {
    state.cell = Number(event.target.value);
    localStorage.setItem("cell", state.cell);
    render();
  }
  if (event.target.id === "radius") {
    state.radius = Number(event.target.value);
    updateDrawerControls();
  }
  if (event.target.dataset.adjust) {
    state.adjust[event.target.dataset.adjust] = Number(event.target.value);
    updateDrawerControls();
  }
});

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector("#search")?.focus();
  }
  if (event.key === "Escape") {
    state.pop = null;
    state.selected = null;
    render();
  }
});

function findApp(id) {
  return [...state.library.apps, ...state.favs].find(app => String(app.id) === String(id));
}

function isFav(id) {
  return state.favs.some(app => String(app.id) === String(id));
}

function toggleFav(app) {
  state.favs = isFav(app.id) ? state.favs.filter(item => item.id !== app.id) : [app, ...state.favs];
  localStorage.setItem("favs", JSON.stringify(state.favs));
  render();
}

let sentinelObserver;

function observeSentinel() {
  sentinelObserver?.disconnect();
  const sentinel = document.querySelector(".scroll-sentinel");
  if (!sentinel) return;
  sentinelObserver = new IntersectionObserver(entries => {
    if (entries[0]?.isIntersecting) loadMore();
  }, { rootMargin: "900px" });
  sentinelObserver.observe(sentinel);
}

function loadMore() {
  const total = visibleApps().length;
  if (state.visibleCount >= total) return;
  state.visibleCount = Math.min(state.visibleCount + 160, total);
  render();
}

function resetVisibleCount() {
  state.visibleCount = 160;
}

function hasActiveVisualFilters() {
  return Boolean(state.filters.colors.size || state.filters.text || state.filters.dimensional);
}

function countMeta(key) {
  return Object.values(state.iconMeta).filter(meta => meta[key]).length;
}

function startIconAnalysis() {
  if (analysisStarted) return;
  analysisStarted = true;
  const pending = state.library.apps.filter(app => !state.iconMeta[app.id]);
  analyzeQueue(pending);
}

function analyzeQueue(queue) {
  const next = () => {
    const app = queue.shift();
    if (!app) {
      flushIconMeta();
      return;
    }
    analyzeIcon(app)
      .then(meta => {
        state.iconMeta[app.id] = meta;
        analysisDirty = true;
      })
      .catch(() => {})
      .finally(() => {
        if (analysisDirty && Object.keys(state.iconMeta).length % 80 === 0) {
          flushIconMeta();
          if (state.pop === "filters" || hasActiveVisualFilters()) render();
        }
        scheduleIdle(next);
      });
  };
  scheduleIdle(next);
}

function analyzeIcon(app) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 32;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      resolve(readIconMeta(data, size));
    };
    img.onerror = reject;
    img.src = app.icon;
  });
}

function readIconMeta(data, size) {
  let r = 0;
  let g = 0;
  let b = 0;
  let satTotal = 0;
  let lumTotal = 0;
  let lumSq = 0;
  let count = 0;
  const colors = new Set();
  const lums = [];

  for (let i = 0; i < data.length; i += 4) {
    const rr = data[i];
    const gg = data[i + 1];
    const bb = data[i + 2];
    const hsl = rgbToHsl(rr, gg, bb);
    const lum = .2126 * rr + .7152 * gg + .0722 * bb;
    r += rr;
    g += gg;
    b += bb;
    satTotal += hsl.s;
    lumTotal += lum;
    lumSq += lum * lum;
    count += 1;
    lums.push(lum);
    colors.add(`${rr >> 4}-${gg >> 4}-${bb >> 4}`);
  }

  const avg = [r / count, g / count, b / count];
  const avgHsl = rgbToHsl(avg[0], avg[1], avg[2]);
  const avgSat = satTotal / count;
  const avgLum = lumTotal / count;
  const lumStd = Math.sqrt(Math.max(0, lumSq / count - avgLum * avgLum));
  let edges = 0;
  let compared = 0;

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const i = y * size + x;
      if (Math.abs(lums[i] - lums[i + 1]) > 42 || Math.abs(lums[i] - lums[i + size]) > 42) edges += 1;
      compared += 1;
    }
  }

  const edgeDensity = edges / compared;
  const variety = colors.size;
  return {
    color: colorBucket(avgHsl.h, avgSat, avgLum),
    text: edgeDensity > .18 && variety < 170,
    dimensional: lumStd > 46 && variety > 145 && edgeDensity < .32
  };
}

function colorBucket(hue, sat, lum) {
  if (sat < .18 || lum < 28 || lum > 232) return "mono";
  if (hue < 18 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 72) return "yellow";
  if (hue < 155) return "green";
  if (hue < 195) return "cyan";
  if (hue < 255) return "blue";
  if (hue < 292) return "purple";
  if (hue < 345) return "pink";
  return "mono";
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function scheduleIdle(fn) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(fn, { timeout: 500 });
  } else {
    setTimeout(fn, 12);
  }
}

function flushIconMeta() {
  if (!analysisDirty) return;
  try {
    localStorage.setItem("iconMeta:v1", JSON.stringify(state.iconMeta));
  } catch {}
  analysisDirty = false;
}

function resetAdjust() {
  state.adjust = { gray: false, invert: false, exposure: 1, contrast: 1, saturation: 1, temp: 0, tint: 0, hue: 0 };
  state.radius = 23;
  state.size = 1024;
}

function updateDrawerControls() {
  const drawer = document.querySelector(".drawer");
  if (!drawer || !state.selected) {
    render();
    return;
  }

  const stageImg = drawer.querySelector(".stage-img");
  if (stageImg) {
    stageImg.style.borderRadius = `${state.radius}%`;
    stageImg.style.filter = canvasFilter();
  }

  const shapeLabel = drawer.querySelector("[data-drawer-value='shape']");
  if (shapeLabel) shapeLabel.textContent = state.radius >= 50 ? "circle" : `${state.radius}%`;

  const sizeLabel = drawer.querySelector("[data-drawer-value='size']");
  if (sizeLabel) sizeLabel.textContent = `${state.size}px`;

  const radiusInput = drawer.querySelector("#radius");
  if (radiusInput) radiusInput.value = state.radius;

  drawer.querySelectorAll("[data-radius]").forEach(button => {
    button.classList.toggle("on", Number(button.dataset.radius) === state.radius);
  });
  drawer.querySelectorAll("[data-size]").forEach(button => {
    button.classList.toggle("on", Number(button.dataset.size) === state.size);
  });
  drawer.querySelectorAll("[data-switch]").forEach(button => {
    const on = Boolean(state.adjust[button.dataset.switch]);
    button.classList.toggle("on", on);
    button.setAttribute("aria-checked", String(on));
  });
  drawer.querySelectorAll("[data-adjust]").forEach(input => {
    input.value = state.adjust[input.dataset.adjust];
    const valueNode = input.closest(".adj")?.querySelector(".adj-val");
    if (valueNode) valueNode.textContent = formatAdjustValue(input.dataset.adjust, state.adjust[input.dataset.adjust]);
  });
}

function formatAdjustValue(key, value) {
  if (key === "hue") return `${Math.round(value)}°`;
  return signed(Math.round((value - 1) * 100));
}

function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => {
    state.toast = "Local icon path copied";
    render();
    setTimeout(() => {
      state.toast = "";
      render();
    }, 1500);
  });
}

async function downloadCustomIcon(app) {
  const blob = await renderCustomIconBlob(app);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(app.name)}-${state.size}px.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderCustomIconBlob(app) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = state.size;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      roundedClip(ctx, size, state.radius);
      ctx.filter = canvasFilter();
      ctx.drawImage(img, 0, 0, size, size);
      ctx.restore();
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to render icon"));
      }, "image/png");
    };
    img.onerror = reject;
    img.src = app.icon;
  });
}

function roundedClip(ctx, size, radiusPercent) {
  const radius = radiusPercent >= 50 ? size / 2 : size * (radiusPercent / 100);
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.clip();
}

function canvasFilter() {
  return [
    `brightness(${state.adjust.exposure})`,
    `contrast(${state.adjust.contrast})`,
    `saturate(${state.adjust.saturation})`,
    state.adjust.hue ? `hue-rotate(${state.adjust.hue}deg)` : "",
    state.adjust.gray ? "grayscale(1)" : "",
    state.adjust.invert ? "invert(1)" : ""
  ].filter(Boolean).join(" ");
}

function slug(value) {
  return String(value || "icon").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "icon";
}

function icon(children) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
