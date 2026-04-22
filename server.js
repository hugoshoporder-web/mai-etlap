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
body{font-family:system-ui,sans-serif}
h1,h2{font-size:1.4em}
ul{list-style:none;padding-left:1.2em;margin:0.2em 0 0.4em}
li{line-height:1.2}
li::before{content:"– "}
.divider{border:none;border-top:1px solid #999;margin:0.6em 0}
a{text-decoration:none;color:#000}
</style>
`;

/* ===== FŐOLDAL ===== */
app.get("/", async (req,res)=>{
  const db = await loadData();
  const etteremek = Object.keys(db).sort((a,b)=>a.localeCompare(b,"hu"));
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.write(`<!doctype html><html lang="hu"><head><meta charset="utf-8">${style}</head><body>`);
  res.write(`<h1>Heti menük</h1><ul>`);
  etteremek.forEach(e=>{
    res.write(
      `<li><a href="/etterem/${encodeURIComponent(e)}">▶ ${e}</a></li>`
    );
  });
  res.write(`</ul>`);

  // QR a főoldalra
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(baseUrl)}`;
  res.write(`<p><img src="${qr}" alt="QR kód"></p>`);
  res.write(`<p style="font-weight:bold;text-align:center">by István Gris</p>`);
  res.write(`</body></html>`);
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
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);

  const todayIso = iso(today);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = iso(tomorrow);

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const pageUrl = `${baseUrl}/etterem/${encodeURIComponent(etterem)}`;

  res.write(`<!doctype html><html lang="hu"><head><meta charset="utf-8">${style}</head><body>`);

  // Visszalink — HELYES
  res.write(`<p><a href="/">← Vissza az éttermekhez</a></p>`);

  res.write(`<h1>Heti menü – ${etterem} (${fmt(monday)}. – ${fmt(friday)}.)</h1>`);

  // Mai nap
  if (data[todayIso]) {
    res.write(`<hr class="divider"><h2>Mai nap – ${capitalize(napNevek[today.getDay()])} ${fmt(today)}</h2>`);
    renderDay(res, data[todayIso]);
  }

  // Következő nap
  if (data[tomorrowIso]) {
    res.write(`<hr class="divider"><h2>Következő nap – ${capitalize(napNevek[tomorrow.getDay()])} ${fmt(tomorrow)}</h2>`);
    renderDay(res, data[tomorrowIso]);
  }

  // Aktuális hét – ALAPBÓL CSUKVA (NINCS 'open')
  const future=[];
  for(let i=0;i<5;i++){
    const d=new Date(monday); d.setDate(monday.getDate()+i);
    if(data[iso(d)] && d>tomorrow) future.push(d);
  }
  if(future.length){
    res.write(`<hr class="divider"><details><summary>Aktuális hét további napjai</summary>`);
    future.forEach(d=>{
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} ${fmt(d)}</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`</details>`);
  }

  // Következő hét
  const nextWeekMonday=new Date(monday); nextWeekMonday.setDate(monday.getDate()+7);
  const next=[];
  for(let i=0;i<5;i++){
    const d=new Date(nextWeekMonday); d.setDate(nextWeekMonday.getDate()+i);
    if(data[iso(d)]) next.push(d);
  }
  if(next.length){
    res.write(`<details><summary>Következő hét</summary>`);
    next.forEach(d=>{
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} ${fmt(d)}</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`</details>`);
  }

  // QR — NINCS ELŐTTE VONAL
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl)}`;
  res.write(`<p><img src="${qr}" alt="QR kód"></p>`);
  res.write(`<p style="font-weight:bold;text-align:center">by István Gris</p>`);

  res.write(`</body></html>`);
  res.end();
});

app.listen(port,()=>console.log("Menü szerver fut – fixelt lenyíló és QR"));
