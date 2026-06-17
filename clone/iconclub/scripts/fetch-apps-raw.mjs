import { writeFile } from "node:fs/promises";

const SUPABASE = "https://tppiihxmmfwvjdrucrrd.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwcGlpaHhtbWZ3dmpkcnVjcnJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0Njk1NDAsImV4cCI6MjA5NzA0NTU0MH0.dYPUYYgIdLGncdscgriIFW2APCEfAr5796ChAPZ6CjY";
const TARGET = Number(process.argv[2] || 5000);
const PAGE = 1000;

const apps = [];

for (let offset = 0; offset < TARGET; offset += PAGE) {
  const limit = Math.min(PAGE, TARGET - offset);
  const url = new URL(`${SUPABASE}/rest/v1/apps`);
  url.searchParams.set("select", "*");
  url.searchParams.set("order", "rating_count.desc.nullslast");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const response = await fetch(url, { headers: { apikey: KEY } });
  if (!response.ok) throw new Error(`Fetch failed at offset ${offset}: ${response.status}`);

  const batch = await response.json();
  apps.push(...batch);
  console.log(`fetched ${apps.length}/${TARGET}`);
  if (batch.length < limit) break;
}

await writeFile("data/apps-raw.json", JSON.stringify(apps, null, 2));
console.log(`wrote data/apps-raw.json (${apps.length} apps)`);
