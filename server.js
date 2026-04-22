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

const todayHu = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" }));

const weekMonday = d => {
  const x = new Date(d);
  const diff = x.getDay() === 0 ? -6 : 1 - x.getDay();
  x.setDate(x.getDate() + diff);
  return x;
};

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
    map[r.etterem] ??= {};
    map[r.etterem][r.datum] ??= {};
    map[r.etterem][r.datum][r.tipus] ??= [];
    map[r.etterem][r.datum][r.tipus].push(r.etel);
  });

  return map;
}

/* ===== STÍLUS ===== */

const style = `
<style>
body { font-family: system-ui, sans-serif; }

h1, h2 { font-size: 1.4em; margin: 0.4em 0; }
h3 { margin: 0.3em 0; }

ul {
  list-style: none;
  padding-left: 1.2em;
  margin: 0.2em 0 0.4em;
}

li {
  line-height: 1.35;
  word-break: break-word;
  overflow-wrap: anywhere;
}

li::before { content: "– "; }

a { text-decoration: none; color: #000; }

/* ---- SZÖVEGHEZ IGAZODÓ VONAL ---- */
.title-line {
  display: flex;
  align-items: center;
  gap: 0.6em;
  margin: 0.6em 0 0.4em;
  flex-wrap: wrap;
}

.title-line::before,
.title-line::after {
  content: "";
  flex-grow: 1;
  min-width: 2em;
  border-top: 1px solid #999;
}

.title-line h2 {
  margin: 0;
  white-space: normal;
}
</style>
`;

/* ===== ÉTTEREM OLDAL ===== */

app.get("/etterem/:etterem", async (req, res) => {
  const db = await loadData();
  const etterem = req.params.etterem;
  const data = db[etterem];
  if (!data) return res.status(404).send("Nincs ilyen étterem.");

  const today = todayHu();
  const monday = weekMonday(today);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);

  const todayIso = iso(today);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = iso(tomorrow);

  const pageUrl = `${req.protocol}://${req.get("host")}/etterem/${encodeURIComponent(etterem)}`;

  res.write(`<!doctype html><html lang="hu"><head><meta charset="utf-8">${style}</head><body>`);
  res.write(`<p>← /Vissza az éttermekhez</a></p>`);
  res.write(`<h1>Heti menü – ${etterem} (${fmt(monday)}. – ${fmt(friday)}.)</h1>`);

  if (data[todayIso]) {
    res.write(`<div class="title-line"><h2>Mai nap – ${capitalize(napNevek[today.getDay()])} ${fmt(today)}</h2></div>`);
    renderDay(res, data[todayIso]);
  }

  if (data[tomorrowIso]) {
    res.write(`<div class="title-line"><h2>Következő nap – ${capitalize(napNevek[tomorrow.getDay()])} ${fmt(tomorrow)}</h2></div>`);
    renderDay(res, data[tomorrowIso]);
  }

  const future = [];
  for (let i=0;i<5;i++){
    const d=new Date(monday); d.setDate(monday.getDate()+i);
    if (data[iso(d)] && d>tomorrow) future.push(d);
  }

  if (future.length) {
    res.write(`<details><summary class="title-line">Aktuális hét további napjai</summary>`);
    future.forEach(d => {
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} ${fmt(d)}</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`</details>`);
  }

  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl)}`;
  res.write(`<p>${qr}</p>`);
  res.write(`<p style="font-weight:bold;text-align:center">by István Gris</p>`);
  res.write(`</body></html>`);
  res.end();
});

app.listen(port, () =>
  console.log("Menü szerver fut – mobilbarát tördeléssel")
);
