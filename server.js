const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ===== SEGÉD ===== */

const napNevek = ["vasárnap","hétfő","kedd","szerda","csütörtök","péntek","szombat"];
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const iso = d => d.toISOString().split("T")[0];

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
    dayData[tipus].forEach(e => res.write(`<li>${e}</li>`));
    res.write(`</ul>`);
  }
}

/* ===== ADATBETÖLTÉS – dátum normalizálva ===== */

async function loadData() {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

  const map = {};
  rows.forEach(r => {
    if (!r.etterem || !r.datum || !r.etel) return;

    const isoDate = r.datum
      .trim()
      .replace(/\.$/, "")
      .replace(/\./g, "-");

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
body{font-family:system-ui,sans-serif;margin:1em}
ul{list-style:none;padding-left:1.2em}
li::before{content:"– "}
.section-title{font-weight:bold;margin-top:1em}
details{margin-top:1em}
</style>
`;

/* ===== ÉTTEREM OLDAL ===== */

app.get("/etterem/:etterem", async (req,res)=>{
  const db = await loadData();
  const etterem = req.params.etterem;
  const data = db[etterem];
  if (!data) return res.status(404).send("Nincs ilyen étterem.");

  const today = todayHu();
  const monday = weekMonday(today);

  res.write(`<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${style}
</head><body>`);

  res.write(`<h1>Heti menü – ${etterem}</h1>`);

  /* ===== KÖVETKEZŐ HÉT – JAVÍTOTT ===== */

  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  const nextDays = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);
    const key = iso(d);
    if (data[key]) nextDays.push({ d, key });
  }

  if (nextDays.length) {
    res.write(`<details><summary>Következő hét</summary>`);
    nextDays.forEach(({ d, key }) => {
      res.write(
        `<div class="section-title">${capitalize(napNevek[d.getDay()])}</div>`
      );
      renderDay(res, data[key]);
    });
    res.write(`</details>`);
  }

  res.write(`</body></html>`);
  res.end();
});

app.listen(port,()=>console.log("Menü szerver fut – következő hét javítva"));
