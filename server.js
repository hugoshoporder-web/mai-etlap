// ===== server.js =====
// QR hozzáadva
// Minden más változatlan

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

function renderDay(res, dayData) {
  for (const tipus in dayData) {
    res.write(`<strong>${tipus}</strong><ul>`);
    dayData[tipus].forEach(etel => {
      res.write(`<li>${etel}</li>`);
    });
    res.write(`</ul>`);
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

  const map = {};

  rows.forEach(r => {
    if (!r.etterem || !r.datum || !r.etel) return;

    const isoDate = r.datum.trim().replace(/\.$/, "").replace(/\./g, "-");

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

/* ===== FŐOLDAL ===== */

app.get("/", async (req, res) => {
  const db = await loadData();
  const etteremek = Object.keys(db).sort((a,b)=>a.localeCompare(b,"hu"));

  res.write(`<!doctype html><html lang="hu"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${style}
</head><body>`);

  res.write(`<h1>Heti menük</h1><ul>`);
  etteremek.forEach(e => {
    res.write(`<li>/etterem/${encodeURIComponent(e)}${e}</li>`);
  });
  res.write(`</ul>`);

  // ✅ QR – FŐOLDAL
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  res.write(
    `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(baseUrl)}">`
  );

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
  const todayIso = iso(today);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  const tomorrowIso = iso(tomorrow);

  res.write(`<!doctype html><html lang="hu"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${style}
</head><body>`);

  res.write(`<h1>Heti menü – ${etterem}</h1>`);

  if (data[todayIso]) {
    renderDay(res, data[todayIso]);
  }
  if (data[tomorrowIso]) {
    renderDay(res, data[tomorrowIso]);
  }

  // ✅ QR – ÉTTEREM OLDAL
  const pageUrl = `${req.protocol}://${req.get("host")}/etterem/${encodeURIComponent(etterem)}`;
  res.write(
    `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl)}">`
  );

  res.write(`</body></html>`);
  res.end();
});

app.listen(port, () => {
  console.log("Menü szerver fut – QR hozzáadva");
});
