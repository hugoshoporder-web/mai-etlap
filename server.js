const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ===== SEGÉDFÜGGVÉNYEK ===== */

const napNevek = ["vasárnap","hétfő","kedd","szerda","csütörtök","péntek","szombat"];
const honapRovid = ["jan.","febr.","márc.","ápr.","máj.","jún.","júl.","aug.","szept.","okt.","nov.","dec."];

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeSlug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function todayHu() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
}

function weekMonday(date) {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d;
}

function iso(d) {
  return d.toISOString().split("T")[0];
}

function formatHuDate(d) {
  return `${honapRovid[d.getMonth()]} ${d.getDate()}.`;
}

function renderDay(res, data) {
  for (const tipus in data) {
    res.write("<strong>" + tipus + "</strong><ul>");
    data[tipus].forEach(e => res.write("<li>" + e + "</li>"));
    res.write("</ul>");
  }
}

/* ===== ADAT BETÖLTÉS ===== */

async function loadData() {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

  const byRestaurant = {};
  rows.forEach(r => {
    if (!r.etterem || !r.datum || !r.etel) return;

    const slug = normalizeSlug(r.etterem);

    byRestaurant[slug] ??= {
      name: r.etterem,
      data: {}
    };

    byRestaurant[slug].data[r.datum] ??= {};
    byRestaurant[slug].data[r.datum][r.tipus] ??= [];
    byRestaurant[slug].data[r.datum][r.tipus].push(r.etel);
  });

  return byRestaurant;
}

/* ===== FŐOLDAL ===== */

app.get("/", async (req, res) => {
  const restaurants = await loadData();

  const list = Object.values(restaurants)
    .map(r => ({ name: r.name, slug: normalizeSlug(r.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, "hu"));

  const baseUrl = req.protocol + "://" + req.get("host");

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Heti menük</title>");
  res.write(`
    <style>
      body { font-family: system-ui, sans-serif; }
      ul { list-style:none; padding-left:0; }
      li { margin:0.5em 0; font-size:1.2em; }
      a { text-decoration:none; color:#000; }
    </style>
  `);
  res.write("</head><body>");

  res.write("<h1>Heti menük</h1>");
  res.write("<p>Válassz éttermet:</p><ul>");

  list.forEach(r => {
    res.write(`<li>/etterem/${r.slug}▶ ${r.name}</a></li>`);
  });

  res.write("</ul><hr>");

  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write(`${qrUrl}<p>${baseUrl}</p>`);
  res.write("<p style='font-weight:bold;text-align:center;'>by István Gris</p>");

  res.write("</body></html>");
  res.end();
});

/* ===== ÉTTEREM OLDAL ===== */

app.get("/etterem/:slug", async (req, res) => {
  const restaurants = await loadData();
  const entry = restaurants[req.params.slug];
  if (!entry) {
    res.status(404).send("Nincs ilyen étterem.");
    return;
  }

  const data = entry.data;
  const name = entry.name;

  const today = todayHu();
  const monday = weekMonday(today);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const todayIso = iso(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = iso(tomorrow);

  const baseUrl = req.protocol + "://" + req.get("host");
  const pageUrl = `${baseUrl}/etterem/${req.params.slug}`;

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write(`<title>Heti menü – ${name}</title>`);
  res.write(`
    <style>
      body { font-family: system-ui, sans-serif; }
      ul { list-style:none; padding-left:1.2em; }
      li::before { content:"– "; }
      a { text-decoration:none; }
    </style>
  `);
  res.write("</head><body>");

  res.write(`<p>/</p>`);
  res.write(`<h1>Heti menü – ${name} (${formatHuDate(monday)} – ${formatHuDate(friday)})</h1>`);

  if (data[todayIso]) {
    res.write(`<h2>Mai nap – (${formatHuDate(today)})</h2>`);
    renderDay(res, data[todayIso]);
  }

  if (data[tomorrowIso]) {
    res.write(`<h2>Következő nap – (${formatHuDate(tomorrow)})</h2>`);
    renderDay(res, data[tomorrowIso]);
  }

  const extraDays = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = iso(d);
    if (data[key] && d > tomorrow) {
      extraDays.push(d);
    }
  }

  if (extraDays.length) {
    res.write("<details><summary>Aktuális hét további napjai</summary>");
    extraDays.forEach(d => {
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} – (${formatHuDate(d)})</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write("</details>");
  }

  const nextWeekMonday = new Date(monday);
  nextWeekMonday.setDate(monday.getDate() + 7);
  const nextWeekDays = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(nextWeekMonday);
    d.setDate(nextWeekMonday.getDate() + i);
    if (data[iso(d)]) nextWeekDays.push(d);
  }

  if (nextWeekDays.length) {
    res.write("<details><summary>Következő hét</summary>");
    nextWeekDays.forEach(d => {
      res.write(`<h3>${capitalize(napNevek[d.getDay()])} – (${formatHuDate(d)})</h3>`);
      renderDay(res, data[iso(d)]);
    });
    res.write("</details>");
  }

  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(pageUrl);

  res.write(`<hr>${qrUrl}<p>${pageUrl}</p>`);
  res.write("<p>~10s Server Wake-Up</p>");
  res.write("<p style='font-weight:bold;text-align:center;'>by István Gris</p>");

  res.write("</body></html>");
  res.end();
});

/* ===== INDÍTÁS ===== */

app.listen(port, () => {
  console.log("Menü szerver fut – több éttermes verzió");
});
