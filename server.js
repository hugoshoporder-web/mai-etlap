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

/* ===== ADATBETÖLTÉS (DÁTUM NORMALIZÁLÁS) ===== */

async function loadData() {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  const map = {};

  rows.forEach(r => {
    if (!r.etterem || !r.datum || !r.etel) return;

    const isoDate = r.datum
      .trim()
      .replace(/\.$/, "")
      .replace(/\./g, "-"); // 2026.04.27. → 2026-04-27

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
ul { list-style:none; padding-left:1.2em; }
li::before { content:"– "; }
details { margin-top:1em; }
img { max-width:100%; height:auto; }
</style>
`;

/* ===== GOOGLE ANALYTICS (GA4 – HELYES) ===== */

const ga = `
<script async src="https://www.googletagmanager.com/gtag/js?id=G-92VX8WYT6W"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-92VX8WYT6W');
</script>
`;

/* ===== F3 – CSAK ASZTALI ===== */

const f3 = `
<script>
(function(){
  const isDesktop = !("ontouchstart" in window) && window.innerWidth > 768;
  if (!isDesktop) return;

  document.addEventListener("keydown", e => {
    if (e.key === "F3") {
      e.preventDefault();
      location.href = "/";
    }
  });
})();
</script>
`;

/* ===== FŐOLDAL ===== */

app.get("/", async (req,res)=>{
  const db = await loadData();
  const etteremek = Object.keys(db).sort((a,b)=>a.localeCompare(b,"hu"));
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.write(`<!doctype html><html lang="hu"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${ga}
${style}
</head><body>`);

  res.write(`<h1>Heti menük</h1><ul>`);
  etteremek.forEach(e=>{
    res.write(`<li><a href="/etterem/${encodeURIComponent(e)}">${e}</a></li>`);
  });
  res.write(`</ul>`);

  res.write(`<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(baseUrl)}">`);

  res.write(`${f3}</body></html>`);
  res.end();
});

/* ===== ÉTTEREM OLDAL ===== */

app.get("/etterem/:etterem", async (req,res)=>{
  const db = await loadData();
  const etterem = req.params.etterem;
  const data = db[etterem];
  if (!data) return res.status(404).send("Nincs ilyen étterem.");

  const today = todayHu();
  const monday = weekMonday(today);

  res.write(`<!doctype html><html lang="hu"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${ga}
${style}
</head><body>`);

  res.write(`<h1>Heti menü – ${etterem}</h1>`);

  // Következő hét (a JÓ logika, lenyíló, napokkal)
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate()+7);

  const nextDays = [];
  for (let i=0;i<5;i++){
    const d=new Date(nextMonday); d.setDate(nextMonday.getDate()+i);
    if (data[iso(d)]) nextDays.push(d);
  }

  if (nextDays.length){
    res.write(`<details><summary>Következő hét</summary>`);
    nextDays.forEach(d=>{
      res.write(`<h3>${capitalize(napNevek[d.getDay()])}</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`</details>`);
  }

  res.write(`${f3}</body></html>`);
  res.end();
});

app.listen(port,()=>console.log("Menü szerver fut – stabil alap + QR + GA + F3"));
