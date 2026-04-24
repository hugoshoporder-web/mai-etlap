const express = require("express");
OK";const fetch = require("node-fetch");

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

/* ===== ADATBETÖLTÉS – JAVÍTVA ===== */

async function loadData() {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

  const map = {};

  rows.forEach(r => {
    if (!r.etterem || !r.datum || !r.etel) return;

    // 2026.04.20. → 2026-04-20
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
ul{list-style:none;padding-left:1.2em;margin:.3em 0 .8em}
li::before{content:"– "}
.section-title{display:flex;align-items:center;gap:.5em;margin:.8em 0 .4em}
.section-title::before,.section-title::after{content:"";flex:1;height:1px;background:#999}
.section-title span{font-weight:bold}
</style>
`;

/* ===== FŐOLDAL ===== */

app.get("/", async (req,res)=>{
  const db = await loadData();
  const etteremek = Object.keys(db).sort();

  res.write(`<!doctype html><html><head>${style}</head><body>`);
  res.write(`<h1>Heti menük</h1><ul>`);
  etteremek.forEach(e=>{
    res.write(`<li>/etterem/${encodeURIComponent(e)}${e}</li>`);
  });
  res.write(`</ul></body></html>`);
  res.end();
});

/* ===== ÉTTEREM OLDAL ===== */

app.get("/etterem/:etterem", async (req,res)=>{
  const db = await loadData();
  const etterem = req.params.etterem;
  const data = db[etterem];
  if(!data) return res.status(404).send("Nincs ilyen étterem.");

  const today = todayHu();
  const todayIso = iso(today);

  res.write(`<!doctype html><html><head>${style}</head><body>`);
  res.write(`<h1>Heti menü – ${etterem}</h1>`);

  if (data[todayIso]) {
    renderDay(res, data[todayIso]);
  }

  res.write(`</body></html>`);
  res.end();
});

app.listen(port,()=>console.log("Menü szerver fut – dátum javítva"));
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
