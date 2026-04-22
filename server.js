const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ===== SEGÉD ===== */

const napNevek = [
  "vasárnap","hétfő","kedd","szerda","csütörtök","péntek","szombat"
];
const honapRovid = [
  "jan.","febr.","márc.","ápr.","máj.","jún.",
  "júl.","aug.","szept.","okt.","nov.","dec."
];

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeSlug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function todayHu() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
}

function weekMonday(date) {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d;
}

function iso(d) {
  return d.toISOString().split("T")[0];
}

function formatHuDate(d) {
  return `${honapRovid[d.getMonth()]} ${d.getDate()}`;
}

function formatDayLine(prefix, d) {
  return `${prefix} – ${capitalize(napNevek[d.getDay()])} ${formatHuDate(d)}`;
}

function renderDay(res, data) {
  for (const tipus in data) {
    res.write("<strong>" + tipus + "</strong><ul>");
    data[tipus].forEach(e => res.write("<li>" + e + "</li>"));
    res.write("</ul>");
  }
}

/* ===== ADATBETÖLTÉS ===== */

async function loadData() {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

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

/* ===== KÖZÖS CSS ===== */

const commonStyle = `
<style>
  body { font-family: system-ui, sans-serif; }
  ul {
    list-style: none;
    padding-left: 1.2em;
    margin-top: 0.2em;
    margin-bottom: 0.4em;
  }
  li { line-height: 1.2; }
  li::before { content:"– "; }
  a { text-decoration:none; color:#000; }
</style>
`;

/* ===== FŐOLDAL ===== */

app.get("/", async (req, res) => {
  const restaurants = await loadData();

  const list = Object.values(restaurants)
    .map(r => ({ name: r.name, slug: normalizeSlug(r.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, "hu"));

  const baseUrl = req.protocol + "://" + req.get("host");

  res.write(`<!DOCTYPE html><html lang="hu"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Heti menük</title>
    ${commonStyle}
  </head><body>`);

  res.write(`<h1>Heti menük</h1><p>Válassz éttermet:</p><ul>`);

  list.forEach(r => {
    res.write(`<li><a href="/etterem/${r.slug}">▶ ${r.name}</a></li>`);
  });

  res.write(`</ul><hr>`);

  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write(`<img src="${qrUrl}" alt="QR kód">`);
  res.write(`<p>${baseUrl}</p>`);
  res.write(`<p style="font-weight:bold;text-align:center;">by István Gris</p>`);

  res.write(`</body></html>`);
  res.end();
});

/* ===== ÉTTEREM OLDAL ===== */

app.get("/etterem/:slug", async (req, res) => {
  const restaurants = await loadData();
  const entry = restaurants[req.params.slug];
  if (!entry) {
    res.status(404).send("Nincs ilyen étterem.");
    return;
  }

  const today = todayHu();
  const monday = weekMonday(today);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const todayIso = iso(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = iso(tomorrow);

  const baseUrl = req.protocol + "://" + req.get("host");
  const pageUrl = `${baseUrl}/etterem/${req.params.slug}`;

  res.write(`<!DOCTYPE html><html lang="hu"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Heti menü – ${entry.name}</title>
    ${commonStyle}
  </head><body>`);

  res.write(`<p><a href="/">← Vissza az éttermekhez</a></p>`);
  res.write(`<h1>Heti menü – ${entry.name} (${formatHuDate(monday)}. – ${formatHuDate(friday)}.)</h1>`);

  if (entry.data[todayIso]) {
    res.write(`<h2>${formatDayLine("Mai nap", today)}</h2>`);
    renderDay(res, entry.data[todayIso]);
  }

  if (entry.data[tomorrowIso]) {
    res.write(`<h2>${formatDayLine("Következő nap", tomorrow)}</h2>`);
    renderDay(res, entry.data[tomorrowIso]);
  }

  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(pageUrl);

  res.write(`<hr><img src="${qrUrl}" alt="QR kód">`);
  res.write(`<p>${pageUrl}</p>`);
  res.write(`<p>~10s Server Wake-Up</p>`);
  res.write(`<p style="font-weight:bold;text-align:center;">by István Gris</p>`);

  res.write(`</body></html>`);
  res.end();
});

/* ===== INDÍTÁS ===== */

app.listen(port, () => {
  console.log("Menü szerver fut – syntax error javítva");
});
