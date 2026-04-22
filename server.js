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
  return honapRovid[d.getMonth()] + " " + d.getDate();
}

function renderDay(res, d) {
  for (const tipus in d) {
    res.write("<strong>" + tipus + "</strong><ul>");
    d[tipus].forEach(e => res.write("<li>" + e + "</li>"));
    res.write("</ul>");
  }
}

/* ===== ROUTE ===== */

app.get("/", async (req, res) => {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

  const dataByDate = {};
  let etteremNev = "";

  rows.forEach(r => {
    if (!r.datum || !r.etel) return;
    etteremNev = r.etterem;
    dataByDate[r.datum] ??= {};
    dataByDate[r.datum][r.tipus] ??= [];
    dataByDate[r.datum][r.tipus].push(r.etel);
  });

  const today = todayHu();
  const monday = weekMonday(today);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const todayIso = iso(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = iso(tomorrow);

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Heti menü</title>");

  /* Lista stílus */
  res.write(`
    <style>
      ul { list-style:none; padding-left:1.2em; margin:0.2em 0; }
      li { line-height:1.2; }
      li::before { content:"– "; }
    </style>
  `);

  res.write("</head><body>");

  /* ===== FEJLÉC ===== */
  res.write(
    `<h1>Heti menü – ${etteremNev} (${formatHuDate(monday)}–${formatHuDate(friday)}.)</h1>`
  );

  /* ===== MAI NAP ===== */
  if (dataByDate[todayIso]) {
    res.write(`<h2>Mai nap – (${formatHuDate(today)})</h2>`);
    renderDay(res, dataByDate[todayIso]);
  }

  /* ===== KÖVETKEZŐ NAP ===== */
  if (dataByDate[tomorrowIso]) {
    res.write(`<h2>Következő nap – (${formatHuDate(tomorrow)})</h2>`);
    renderDay(res, dataByDate[tomorrowIso]);
  }

  /* ===== AKTUÁLIS HÉT TOVÁBBI NAPJAI ===== */
  const extraCurrentWeek = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = iso(d);
    if (
      dataByDate[key] &&
      key !== todayIso &&
      key !== tomorrowIso &&
      d > tomorrow
    ) {
      extraCurrentWeek.push({ date: d, data: dataByDate[key] });
    }
  }

  if (extraCurrentWeek.length) {
    res.write("<details><summary>Aktuális hét további napjai</summary>");
    extraCurrentWeek.forEach(item => {
      res.write(`<h3>${capitalize(napNevek[item.date.getDay()])} – (${formatHuDate(item.date)})</h3>`);
      renderDay(res, item.data);
    });
    res.write("</details>");
  }

  /* ===== KÖVETKEZŐ HÉT ===== */
  const nextWeekMonday = new Date(monday);
  nextWeekMonday.setDate(monday.getDate() + 7);
  const nextWeekData = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(nextWeekMonday);
    d.setDate(nextWeekMonday.getDate() + i);
    const key = iso(d);
    if (dataByDate[key]) {
      nextWeekData.push({ date: d, data: dataByDate[key] });
    }
  }

  if (nextWeekData.length) {
    res.write("<details><summary>Következő hét</summary>");
    nextWeekData.forEach(item => {
      res.write(`<h3>${capitalize(napNevek[item.date.getDay()])} – (${formatHuDate(item.date)})</h3>`);
      renderDay(res, item.data);
    });
    res.write("</details>");
  }

  /* ===== QR BLOKK ===== */
  const baseUrl = req.protocol + "://" + req.get("host");
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write("<hr>");
  res.write("<h3>Honlap elérhetősége</h3>");
  res.write(`<img src="${qrUrl}" alt="QR kód"><br>`);
  res.write("<p>~10s Server Wake-Up</p>");
  res.write("<p>" + baseUrl + "</p>");

  /* ===== ALÁÍRÁS ===== */
  res.write("<p style='text-align:center;font-weight:bold;'>by István Gris</p>");

  res.write("</body></html>");
  res.end();
});

app.listen(port, () =>
  console.log("Menü szerver fut – végleges, jóváhagyott formátumban")
);
