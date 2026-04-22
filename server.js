// ===== IMPORTOK =====
const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

// ===== APP =====
const app = express();
const port = process.env.PORT || 3000;

// ===== CSV =====
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

// ===== SEGÉDDATOK =====
const napNevek = ["vasárnap","hétfő","kedd","szerda","csütörtök","péntek","szombat"];
const honapRovid = ["jan.","febr.","márc.","ápr.","máj.","jún.","júl.","aug.","szept.","okt.","nov.","dec."];

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

const normalizeSlug = s =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"");

const todayHu = () =>
  new Date(new Date().toLocaleString("en-US",{timeZone:"Europe/Budapest"}));

const weekMonday = d => {
  const x=new Date(d);
  const diff=x.getDay()===0?-6:1-x.getDay();
  x.setDate(x.getDate()+diff);
  return x;
};

const iso = d => d.toISOString().split("T")[0];
const fmt = d => `${honapRovid[d.getMonth()]} ${d.getDate()}`;
const dayLine = (p,d)=>`${p} – ${capitalize(napNevek[d.getDay()])} ${fmt(d)}`;

function renderDay(res,data){
  for(const tipus in data){
    res.write(`<strong>${tipus}</strong><ul>`);
    data[tipus].forEach(e=>res.write(`<li>${e}</li>`));
    res.write(`</ul>`);
  }
}

// ===== ADATBETÖLTÉS =====
async function loadData(){
  const csv=await (await fetch(CSV_URL)).text();
  const rows=parse(csv,{columns:true,skip_empty_lines:true,trim:true});
  const map={};

  rows.forEach(r=>{
    if(!r.etterem||!r.datum||!r.etel) return;
    const slug=normalizeSlug(r.etterem);
    map[slug] ??= {name:r.etterem,data:{}};
    map[slug].data[r.datum] ??= {};
    map[slug].data[r.datum][r.tipus] ??= [];
    map[slug].data[r.datum][r.tipus].push(r.etel);
  });
  return map;
}

// ===== CSS =====
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

// ===== ÉTTEREM OLDAL =====
app.get("/etterem/:slug", async (req,res)=>{
  const db=await loadData();
  const e=db[req.params.slug];
  if(!e) return res.status(404).send("Nincs ilyen étterem.");

  const today=todayHu();
  const monday=weekMonday(today);
  const friday=new Date(monday); friday.setDate(monday.getDate()+4);

  const todayIso=iso(today);
  const tomorrow=new Date(today); tomorrow.setDate(today.getDate()+1);
  const tomorrowIso=iso(tomorrow);

  const baseUrl=`${req.protocol}://${req.get("host")}`;
  const pageUrl=`${baseUrl}/etterem/${req.params.slug}`;

  res.write(`<!doctype html><html><head><meta charset=utf-8>${style}</head><body>`);

  // ✅ HELYES visszalink
  res.write(`<p><a href="/">← Vissza az éttermekhez</a></p>`);

  res.write(`<h1>Heti menü – ${e.name} (${fmt(monday)}. – ${fmt(friday)}.)</h1>`);

  if(e.data[todayIso]){
    res.write(`<hr class="divider"><h2>${dayLine("Mai nap",today)}</h2>`);
    renderDay(res,e.data[todayIso]);
  }

  if(e.data[tomorrowIso]){
    res.write(`<hr class="divider"><h2>${dayLine("Következő nap",tomorrow)}</h2>`);
    renderDay(res,e.data[tomorrowIso]);
  }

  // ✅ QR-kód HELYESEN (képként)
  const qr=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl)}`;
  res.write(`<hr><img src="${qr}" alt="QR kód"><p>${pageUrl}</p>`);

  res.write(`<p>~10s Server Wake‑Up</p><p style="font-weight:bold;text-align:center">by István Gris</p>`);

  res.write(`</body></html>`);
  res.end();
});

// ===== INDÍTÁS =====
app.listen(port,()=>console.log("Menü szerver fut – javított visszalink + QR"));
``
