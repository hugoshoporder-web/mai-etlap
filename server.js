// ===== server.js =====
// STABIL VERZIÓ
// + QR ✅
// + "by István Gris" ✅
// + működő főoldali linkek ✅
// + következő hét ✅
// + F3 visszalépés ✅
// + Google Analytics (GA4) ✅
// SEMMI MÁS NEM VÁLTOZOTT

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
  const rows = parse(csv, { columns:true, skip_empty_lines:true, trim:true });

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
ul { list-style: none; padding-left: 1.2em; margin: .3em 0 .8em; }
li::before { content: "– "; }
img { max-width: 200px; margin-top: 1em; }
.section-title {
  display: flex;
  align-items: center;
  gap: .5em;
  margin: .8em 0 .4em;
}
.section-title::before,
.section-title::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #999;
}
.section-title span { font-weight: bold; white-space: nowrap; }
</style>
`;

/* ===== GOOGLE ANALYTICS ===== */

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

const f3script = `
<script>
(function () {
  const isDesktop = !("ontouchstart" in window) && window.innerWidth > 768;
  if (!isDesktop) return;
  document.addEventListener("keydown", function (e) {
    if (e.key === "F3") {
      e.preventDefault();
      window.location.href = "/";
    }
  });
})();
</script>
`;

/* ===== FŐOLDAL ===== */

app.get("/", async (req, res) => {
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
  etteremek.forEach(e => {
    res.write(`<li><a href="/etterem/${encodeURIComponent(e)}">▶ ${e}</a></li>`);
  });
  res.write(`</ul>`);

  res.write(
    `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(baseUrl)}">`
  );
  res.write(`<p><strong>by István Gris</strong></p>`);

  res.write(`${f3script}</body></html>`);
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

  const pageUrl = `${req.protocol}://${req.get("host")}/etterem/${encodeURIComponent(etterem)}`;

  res.write(`<!doctype html><html lang="hu"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${ga}
${style}
</head><body>`);

  res.write(`<h1>Heti menü – ${etterem}</h1>`);

  if (data[todayIso]) {
    res.write(`<div class="section-title"><span>Mai nap – ${capitalize(napNevek[today.getDay()])} ${fmt(today)}</span></div>`);
    renderDay(res, data[todayIso]);
  }

  if (data[tomorrowIso]) {
    res.write(`<div class="section-title"><span>Következő nap – ${capitalize(napNevek[tomorrow.getDay()])} ${fmt(tomorrow)}</span></div>`);
    renderDay(res, data[tomorrowIso]);
  }

  const nextWeekMonday = new Date(monday);
  nextWeekMonday.setDate(monday.getDate() + 7);
  const next = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(nextWeekMonday);
    d.setDate(nextWeekMonday.getDate() + i);
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

  res.write(
    `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl)}">`
  );
  res.write(`<p><strong>by István Gris</strong></p>`);

  res.write(`${f3script}</body></html>`);
  res.end();
});

app.listen(port, () =>
  console.log("Menü szerver fut – stabil + QR + F3 + GA")
);
``
