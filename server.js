// ===== server.js – teljes, tiszta, FUTTATHATÓ verzió =====
// - nincs duplikált deklaráció
// - magyar dátum (YYYY.MM.DD) normalizálva
// - GA4 (G-92VX8WYT6W) helyesen beillesztve
// - F3: csak asztali gépen visszalép a főoldalra
// - nincs HTML-entitás, nincs csupasz URL
// - CommonJS

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

/* ===== ADATBETÖLTÉS (DÁTUM NORMALIZÁLVA) ===== */

async function loadData() {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  const map = {};

  rows.forEach(r => {
    if (!r.etterem || !r.datum || !r.etel) return;

    // 2026.04.27 → 2026-04-27
    const isoDate = r.datum.replace(/\./g, "-");

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
ul{list-style:none;padding-left:1.2em;margin:.3em 0 .8em}
li::before{content:"– "}
img{max-width:100%;height:auto}
.section-title{display:flex;align-items:center;gap:.5em;margin:.8em 0 .4em}
.section-title::before,.section-title::after{content:"";flex:1;height:1px;background:#999}
.section-title span{white-space:nowrap;font-weight:bold}
@media (max-width:600px){
  .mobile-center{text-align:center}
  .mobile-center img{margin:auto;display:block}
}
</style>
`;

/* ===== GOOGLE ANALYTICS (GA4) ===== */

const ga = `
<script async src="https://www.googletagmanager.com/gtag/js?id=G-92VX8WYT6W"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-92VX8WYT6W');
</script>
`;

/* ===== F3 – CSAK ASZTALI GÉPEN ===== */

const f3script = `
<script>
(function(){
  const isDesktop = !("ontouchstart" in window) && window.innerWidth > 768;
  if (!isDesktop) return;

  document.addEventListener("keydown", function(e){
    if (e.key === "F3") {
      e.preventDefault();
      window.location.href = "/";
    }
  });
})();
</script>
`;

/* ===== FŐOLDAL ===== */

app.get("/", async (req,res)=>{
  const db = await loadData();
  const etteremek = Object.keys(db).sort((a,b)=>a.localeCompare(b,"hu"));

  res.write(`<!doctype html><html lang="hu"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${ga}
${style}
</head><body>`);

  res.write(`<h1>Heti menük</h1><ul>`);
  etteremek.forEach(e=>{
    res.write(`<li><a href="/etterem/${encodeURIComponent(e)}">${e}</a></li>`);
  });
  res.write(`</ul>`);

  res.write(`${f3script}</body></html>`);
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

  const todayIso = iso(today);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  const tomorrowIso = iso(tomorrow);

  res.write(`<!doctype html><html lang="hu"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${ga}
${style}
</head><body>`);

  res.write(`<h1 class="mobile-center">Heti menü – ${etterem}</h1>`);

  if (data[todayIso]) {
    res.write(`<div class="section-title"><span>Mai nap – ${capitalize(napNevek[today.getDay()])} ${fmt(today)}</span></div>`);
    renderDay(res, data[todayIso]);
  }

  if (data[tomorrowIso]) {
    res.write(`<div class="section-title"><span>Következő nap – ${capitalize(napNevek[tomorrow.getDay()])} ${fmt(tomorrow)}</span></div>`);
    renderDay(res, data[tomorrowIso]);
  }

  const future = [];
  for (let i=0;i<5;i++){
    const d=new Date(monday); d.setDate(monday.getDate()+i);
    if (data[iso(d)] && d>tomorrow) future.push(d);
  }

  if (future.length) {
    res.write(`<details><summary>Aktuális hét további napjai</summary>`);
    future.forEach(d=>{
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} ${fmt(d)}</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`</details>`);
  }

  const nextWeekMonday=new Date(monday); nextWeekMonday.setDate(monday.getDate()+7);
  const next=[];
  for (let i=0;i<5;i++){
    const d=new Date(nextWeekMonday); d.setDate(nextWeekMonday.getDate()+i);
    if (data[iso(d)]) next.push(d);
  }

  if (next.length) {
    res.write(`<details><summary>Következő hét</summary>`);
    next.forEach(d=>{
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} ${fmt(d)}</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`</details>`);
  }

  res.write(`${f3script}</body></html>`);
  res.end();
});

app.listen(port,()=>console.log("Menü szerver fut – stabil, tiszta verzió"));
