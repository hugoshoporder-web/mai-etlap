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
    data[tipus].forEach(e => res.write(`<li>${e}</li>`));
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

    const isoDate = r.datum.replace(/\.$/, "").replace(/\./g, "-");

    map[r.etterem] ??= {};
    map[r.etterem][isoDate] ??= {};
    map[r.etterem][isoDate][r.tipus] ??= [];
    map[r.etterem][isoDate][r.tipus].push(r.etel);
  });

  return map;
}

/* ===== STÍLUS ===== */

const style = `
<style>
body { font-family: system-ui, sans-serif; margin: 1em; }
ul { list-style: none; padding-left: 1.2em; }
li::before { content: "– "; }
img { max-width: 200px; margin-top: 1em; }
</style>
`;

/* ===== GA4 ===== */

const ga = `
<script async src="https://www.googletagmanager.com/gtag/js?id=G-92VX8WYT6W"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-92VX8WYT6W');
</script>
`;

/* ===== F3 ===== */

const f3 = `
<script>
document.addEventListener("keydown", e => {
  if (e.key === "F3") {
    e.preventDefault();
    window.location.href = "/";
  }
});
</script>
`;

/* ===== FŐOLDAL ===== */

app.get("/", async (req, res) => {
  const db = await loadData();
  const etteremek = Object.keys(db);
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.write(`<!doctype html><html><head>${ga}${style}</head><body>`);
  res.write(`<h1>Heti menük</h1><ul>`);

  etteremek.forEach(e =>
    res.write(`<li><a href="/etterem/${encodeURIComponent(e)}">${e}</a></li>`)
  );

  res.write(`</ul>`);
  res.write(`<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(baseUrl)}">`);
  res.write(`<p><strong>by István Gris</strong></p>`);
  res.write(`${f3}</body></html>`);
  res.end();
});

/* ===== ÉTTEREM ===== */

app.get("/etterem/:etterem", async (req, res) => {
  const db = await loadData();
  const etterem = req.params.etterem;
  const data = db[etterem];
  if (!data) return res.status(404).send("Nincs ilyen étterem.");

  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  res.write(`<!doctype html><html><head>${ga}${style}</head><body>`);
  res.write(`<h1>${etterem}</h1>`);
  Object.values(data).forEach(d => renderDay(res, d));
  res.write(`<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}">`);
  res.write(`<p><strong>by István Gris</strong></p>`);
  res.write(`${f3}</body></html>`);
  res.end();
});

app.listen(port, () => console.log("Render app fut"));
``
