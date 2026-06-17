import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const raw = JSON.parse(await readFile("data/apps-raw.json", "utf8"));
const out = [];
const CONCURRENCY = Number(process.env.ICON_CONCURRENCY || 16);

await mkdir("assets/icons", { recursive: true });

function extFromUrl(url) {
  const match = url.match(/\.(png|jpg|jpeg|webp)(?:$|\?)/i);
  return (match?.[1] || "jpg").toLowerCase().replace("jpeg", "jpg");
}

function icon1024(url) {
  return (url || "").replace(/\/\d+x\d+bb\.(jpg|png)$/i, "/1024x1024bb.jpg");
}

let completed = 0;
let cursor = 0;

await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < raw.length) {
    const app = raw[cursor++];
    await ensureIcon(app);
    completed += 1;
    if (completed % 250 === 0 || completed === raw.length) console.log(`processed ${completed}/${raw.length}`);
  }
}));

for (const app of raw) {
  const ext = extFromUrl(app.icon);
  let local = `assets/icons/${app.id}.${ext}`;
  if (!existsSync(local)) local = `assets/icons/${app.id}.svg`;
  out.push({
    id: app.id,
    name: app.name,
    developer: app.developer,
    category: app.category,
    year: app.year,
    price: app.price,
    rating: app.rating,
    ratingCount: app.rating_count,
    contentRating: app.content_rating,
    icon: `./${local}`,
    icon1024: `./${local}`
  });
}

const categories = Object.entries(
  out.reduce((acc, app) => {
    acc[app.category] = (acc[app.category] || 0) + 1;
    return acc;
  }, {})
).sort((a, b) => b[1] - a[1]);

await writeFile(
  "data/apps.json",
  JSON.stringify(
    {
      total: out.length,
      sourceTotal: 508041,
      categories,
      generatedAt: new Date().toISOString(),
      apps: out
    },
    null,
    2
  )
);

function slug(name) {
  return (name || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
}

async function ensureIcon(app) {
  const ext = extFromUrl(app.icon);
  const local = `assets/icons/${app.id}.${ext}`;
  if (existsSync(local)) return;
  const result = spawnSync("curl", ["-L", "--fail", "--silent", "--show-error", "--connect-timeout", "8", "--max-time", "25", "-o", local, icon1024(app.icon)], {
    stdio: "pipe"
  });
  if (result.status !== 0) {
    await writeFile(`assets/icons/${app.id}.svg`, svgIcon(app));
  }
}

function svgIcon(app) {
  const seed = hash(`${app.name}${app.category}`);
  const hue = seed % 360;
  const hue2 = (hue + 48 + (seed % 90)) % 360;
  const letters = initials(app.name);
  const bg = `hsl(${hue} 78% 52%)`;
  const bg2 = `hsl(${hue2} 84% 45%)`;
  const accent = `hsl(${(hue + 180) % 360} 95% 72%)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="70" y1="38" x2="438" y2="468" gradientUnits="userSpaceOnUse">
      <stop stop-color="${bg}"/>
      <stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
    <radialGradient id="r" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(142 112) rotate(52) scale(430)">
      <stop stop-color="white" stop-opacity=".48"/>
      <stop offset=".52" stop-color="white" stop-opacity=".08"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </radialGradient>
    <filter id="s" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="black" flood-opacity=".24"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="116" fill="url(#g)"/>
  <rect width="512" height="512" rx="116" fill="url(#r)"/>
  <circle cx="${104 + (seed % 90)}" cy="${110 + (seed % 58)}" r="${42 + (seed % 30)}" fill="${accent}" opacity=".38"/>
  <path d="M80 ${350 + (seed % 42)}C160 ${284 + (seed % 40)} 252 ${426 - (seed % 55)} 432 ${308 + (seed % 70)}" fill="none" stroke="white" stroke-opacity=".28" stroke-width="42" stroke-linecap="round"/>
  <text x="256" y="292" text-anchor="middle" font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${letters.length > 1 ? 132 : 160}" font-weight="750" fill="white" filter="url(#s)">${letters}</text>
</svg>`;
}

function initials(name) {
  const words = String(name || "App").replace(/[:\-–—™®]/g, " ").split(/\s+/).filter(Boolean);
  const chars = words.slice(0, 2).map(word => word[0]).join("");
  return escapeXml((chars || "A").toUpperCase());
}

function hash(value) {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) out = (out * 31 + value.charCodeAt(i)) >>> 0;
  return out;
}

function escapeXml(value) {
  return value.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char]);
}
