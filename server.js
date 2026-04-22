// ===== IMPORTOK =====
const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

// ===== APP =====
const app = express();
const port = process.env.PORT || 3000;

// ===== CSV =====
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

// ===== SEGÉD ADATOK =====
const napNevek = ["vasárnap","hétfő","kedd","szerda","csütörtök","péntek","szombat"];
const honapRovid = ["jan.","febr.","márc.","ápr.","máj.","jún.","júl.","aug.","szept.","okt.","nov.","dec."];

// ===== SEGÉDFÜGGVÉNYEK =====
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

function normalizeSlug(s) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function todayHu() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" }));
}

function weekMonday(date) {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d;
}

const iso = d => d.toISOString().split("T")[0];
const fmt = d => `${honapRovid[d.getMonth()]} ${d.getDate()}`;
const dayLine = (prefix, d) => `${prefix} – ${capitalize(napNevek[d.getDay()])} ${fmt(d)}`;

// ===== HTML RENDER =====
function renderDay(res, data) {
  for (const tipus in data) {
    res.write(`<strong>${tipus}</strong><ul>`);
    data[tipus].forEach(e => res.write(`<li>${e}</li>`));
    res.write(`</ul>`);
  }
}

// ===== ADATBETÖLTÉS =====
async function loadData() {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  const byRestaurant = {};

  rows.forEach(r => {
    if (!r.etterem || !r.datum || !r.etel) return;
    const slug = normalizeSlug(r.etterem);
    byRestaurant[slug] ??= { name: r.etterem, data: {} };
    byRestaurant[slug].data[r.datum] ??= {};
    byRestaurant[slug].data[r.datum][r.tipus] ??= [];
    byRestaurant[slug].data[r.datum][r.tipus].push(r.etel);
  });

  return byRestaurant;
}

// ===== KÖZÖS CSS =====
const commonStyle = `
<style>
  body { font-family: system-ui, sans-serif; }
  /* Heti menü legyen akkora, mint a Mai nap (vizuálisan) */
  h1 { font-size: 1.4em; margin: 0.6em 0; }
  h2 { font-size: 1.4em; margin: 0.4em 0; }
  h3 { margin: 0.4em 0; }

  ul {
    list-style: none;
    padding-left: 1.2em;
    margin-top: 0.2em;
    margin-bottom: 0.4em; /* kisebb térköz a menük után */
  }
  li { line-height: 1.2; }
  li::before { content: "– "; }

  .divider {
    border: none;
    border-top: 1px solid #999;
    margin: 0.6em 0;
    width: 100%;
  }

  a { text-decoration: none; color: #000; }
</style>
`;

// ===== FŐOLDAL =====
app.get("/", async (req, res) => {
  const restaurants = await loadData();
  const list = Object.values(restaurants)
    .map(r => ({ name: r.name, slug: normalizeSlug(r.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, "hu"));

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.write(`<!doctype html><html lang="hu"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Heti menük</title>
    ${commonStyle}
  </head><body>`);

  res.write(`<h1>Heti menük</h1><p>Válassz éttermet:</p><ul>`);
  list.forEach(r => {
    res.write(`<li>/etterem/${r.slug}▶ ${r.name}</a></li>`);
  });
  res.write(`</ul><hr>`);

  const qr =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write(`${qr}<p>${baseUrl}</p><p style="font-weight:bold;text-align:center;">by István Gris</p>`);
  res.write(`</body></html>`);
  res.end();
});

// ===== ÉTTEREM OLDAL =====
app.get("/etterem/:slug", async (req, res) => {
  const restaurants = await loadData();
  const entry = restaurants[req.params.slug];
  if (!entry) return res.status(404).send("Nincs ilyen étterem.");

  const data = entry.data;
  const name = entry.name;

  const today = todayHu();
  const monday = weekMonday(today);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);

  const todayIso = iso(today);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = iso(tomorrow);

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const pageUrl = `${baseUrl}/etterem/${req.params.slug}`;

  res.write(`<!doctype html><html lang="hu"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Heti menü – ${name}</title>
    ${commonStyle}
  </head><body>`);

  res.write(`<p>/← Vissza az éttermekhez</a></p>`);
  res.write(`<h1>Heti menü – ${name} (${fmt(monday)}. – ${fmt(friday)}.)</h1>`);

  /* --- Mai nap (vonal előtte) --- */
  if (data[todayIso]) {
    res.write(`<hr class="divider"><h2>${dayLine("Mai nap", today)}</h2>`);
    renderDay(res, data[todayIso]);
  }

  /* --- Következő nap (vonal előtte) --- */
  if (data[tomorrowIso]) {
    res.write(`<hr class="divider"><h2>${dayLine("Következő nap", tomorrow)}</h2>`);
    renderDay(res, data[tomorrowIso]);
  }

  /* --- Aktuális hét további napjai (vonal előtte) --- */
  const futureThisWeek = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    if (data[iso(d)] && d > tomorrow) futureThisWeek.push(d);
  }

  if (futureThisWeek.length) {
    res.write(`<hr class="divider"><details><summary>Aktuális hét további napjai</summary>`);
    futureThisWeek.forEach(d => {
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} ${fmt(d)}</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`</details>`);
  }

  /* --- Következő hét (nincs vonal előtte) --- */
  const nextWeekMonday = new Date(monday); nextWeekMonday.setDate(monday.getDate() + 7);
  const nextWeekDays = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(nextWeekMonday); d.setDate(nextWeekMonday.getDate() + i);
    if (data[iso(d)]) nextWeekDays.push(d);
  }

  if (nextWeekDays.length) {
    res.write(`<details><summary>Következő hét</summary>`);
    nextWeekDays.forEach(d => {
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} ${fmt(d)}</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`</details>`);
  }

  const qr =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(pageUrl);

  res.write(`<hr>${qr}<p>${pageUrl}</p><p>~10s Server Wake-Up</p><p style="font-weight:bold;text-align:center;">by István Gris</p>`);
  res.write(`</body></html>`);
  res.end();
});

// ===== INDÍTÁS =====
app.listen(port, () => {
  console.log("Menü szerver fut – rögzített vonalakkal és méretekkel");
});
