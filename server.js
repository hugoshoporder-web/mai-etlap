const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ===== SEGÉD ===== */

const napNevek = ["vasárnap","hétfő","kedd","szerda","csütörtök","péntek","szombat"];
const honapRovid = ["jan.","febr.","márc.","ápr.","máj.","jún.","júl.","aug.","szept.","okt.","nov.","dec."];

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const iso = d => d.toISOString().split("T")[0];
const fmt = d => `${honapRovid[d.getMonth()]} ${d.getDate()}`;

function todayHu() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
}

function weekMonday(d) {
  const x = new Date(d);
  const diff = x.getDay() === 0 ? -6 : 1 - x.getDay();
  x.setDate(x.getDate() + diff);
  return x;
}

function renderDay(res, data) {
  for (const tipus in data) {
    res.write(`<strong>${tipus}</strong><ul>`);
    data[tipus].forEach(e =>
      res.write(`<li>${e}</li>`)
    );
    res.write(`</ul>`);
  }
}

/* ===== ADATBETÖLTÉS ===== */

async function loadData() {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, { columns:true, skip_empty_lines:true, trim:true });
  const map = {};

  rows.forEach(r => {
    if (!r.etterem || !r.datum || !r.etel) return;
    map[r.etterem] ??= {};
    map[r.etterem][r.datum] ??= {};
    map[r.etterem][r.datum][r.tipus] ??= [];
    map[r.etterem][r.datum][r.tipus].push(r.etel);
  });

  return map;
}

/* ===== STÍLUS (STABIL, MOBIL-FIRST) ===== */

const style = `
<style>
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  max-width: 720px;       /* mobil + tablet barát */
  margin: 0 auto;
  padding: 0.8em;
}

h1, h2 {
  font-size: 1.25em;
  margin: 0.6em 0 0.3em;
}

details summary {
  font-weight: bold;
  margin-top: 0.6em;
}

ul {
  list-style: none;
  padding-left: 1.2em;
  margin: 0.15em 0 0.5em;
}

li {
  line-height: 1.35;
  overflow-wrap: break-word;
  word-break: break-word;
}

li::before {
  content: "– ";
}

a {
  text-decoration: none;
  color: #000;
}

img {
  max-width: 100%;
  height: auto;
}
</style>
`;

/* ===== FŐOLDAL ===== */

app.get("/", async (req, res) => {
  const db = await loadData();
  const etteremek = Object.keys(db).sort((a,b)=>a.localeCompare(b,"hu"));
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.write(`<!doctype html><html lang="hu"><head>
<meta charset="utf-8">${style}</head><body>`);

  res.write(`<h1>Heti menük</h1><ul>`);
  etteremek.forEach(e => {
    res.write(`<li><a href="/etterem/${encodeURIComponent(e)}">▶ ${e}</a></li>`);
  });
  res.write(`</ul>`);

  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(baseUrl)}`;
  res.write(`<p><img src="${qr}" alt="QR"></p>`);
  res.write(`<p style="font-weight:bold;text-align:center">by István Gris</p>`);

  res.write(`</body></html>`);
  res.end();
});

/* ===== ÉTTEREM OLDAL ===== */

app.get("/etterem/:etterem", async (req, res) => {
  const db = await loadData();
  const etterem = req.params.etterem;
  const data = db[etterem];
  if (!data) return res.status(404).send("Nincs ilyen étterem.");

  const today = todayHu();
  const monday = weekMonday(today);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const todayIso = iso(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = iso(tomorrow);

  const pageUrl = `${req.protocol}://${req.get("host")}/etterem/${encodeURIComponent(etterem)}`;

  res.write(`<!doctype html><html lang="hu"><head>
<meta charset="utf-8">${style}</head><body>`);

  res.write(`<p><a href="/">← Vissza az éttermekhez</a></p>`);
  res.write(`<h1>Heti menü – ${etterem} (${fmt(monday)}. – ${fmt(friday)}.)</h1>`);

  if (data[todayIso]) {
    res.write(`<h2>Mai nap – ${capitalize(napNevek[today.getDay()])} ${fmt(today)}</h2>`);
    renderDay(res, data[todayIso]);
  }

  if (data[tomorrowIso]) {
    res.write(`<h2>Következő nap – ${capitalize(napNevek[tomorrow.getDay()])} ${fmt(tomorrow)}</h2>`);
    renderDay(res, data[tomorrowIso]);
  }

  const future = [];
  for (let i=0;i<5;i++){
    const d=new Date(monday);
    d.setDate(monday.getDate()+i);
    if (data[iso(d)] && d > tomorrow) future.push(d);
  }

  if (future.length) {
    res.write(`<details><summary>Aktuális hét további napjai</summary>`);
    future.forEach(d => {
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} ${fmt(d)}</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`</details>`);
  }

  const nextWeekMonday=new Date(monday);
  nextWeekMonday.setDate(monday.getDate()+7);
  const next=[];
  for(let i=0;i<5;i++){
    const d=new Date(nextWeekMonday);
    d.setDate(nextWeekMonday.getDate()+i);
    if (data[iso(d)]) next.push(d);
  }

  if (next.length) {
    res.write(`<details><summary>Következő hét</summary>`);
    next.forEach(d => {
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} ${fmt(d)}</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`</details>`);
  }

  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl)}`;
  res.write(`<p><img src="${qr}" alt="QR"></p>`);
  res.write(`<p style="font-weight:bold;text-align:center">by István Gris</p>`);

  res.write(`</body></html>`);
  res.end();
});

app.listen(port, () =>
  console.log("Menü szerver fut – stabil mobil-optimalizált verzió")
);
