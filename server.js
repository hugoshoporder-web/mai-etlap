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

function formatShort(d) {
  return honapRovid[d.getMonth()] + " " + d.getDate() + ".";
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

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Heti menü</title>");

  /* Google tag */
  res.write(`
    <!-- Google tag (gtag.js) -->
    https://www.googletagmanager.com/gtag/js?id=G-92VX8WYT6W
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-92VX8WYT6W');
    </script>
  `);

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
    "<h1>Heti menü, " +
    etteremNev + " (" +
    formatShort(monday) + " – " +
    formatShort(friday) +
    ")</h1>"
  );

  /* ===== MAI + KÖVETKEZŐ NAP ===== */
  const todayIso = iso(today);
  if (dataByDate[todayIso]) {
    res.write("<h2>" + todayIso + " – " + capitalize(napNevek[today.getDay()]) + "</h2>");
    renderDay(res, dataByDate[todayIso]);
  }

  const next = new Date(today);
  next.setDate(today.getDate() + 1);
  const nextIso = iso(next);
  if (dataByDate[nextIso]) {
    res.write("<h2>" + nextIso + " – " + capitalize(napNevek[next.getDay()]) + "</h2>");
    renderDay(res, dataByDate[nextIso]);
  }

  /* ===== AKTUÁLIS HÉT TOVÁBBI NAPJAI ===== */
  const currentWeekExtra = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = iso(d);
    if (key !== todayIso && key !== nextIso && dataByDate[key]) {
      currentWeekExtra.push({ date: d, data: dataByDate[key] });
    }
  }

  if (currentWeekExtra.length) {
    res.write("<details><summary>Aktuális hét további napjai</summary>");
    currentWeekExtra.forEach(item => {
      res.write("<h3>" + iso(item.date) + " – " +
        capitalize(napNevek[item.date.getDay()]) + "</h3>");
      renderDay(res, item.data);
    });
    res.write("</details>");
  }

  /* ===== KÖVETKEZŐ HÉT (CSAK ADATTAL RENDELKEZŐ NAPOK) ===== */
  const nextWeekMonday = new Date(monday);
  nextWeekMonday.setDate(monday.getDate() + 7);

  const nextWeekWithData = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(nextWeekMonday);
    d.setDate(nextWeekMonday.getDate() + i);
    const key = iso(d);
    if (dataByDate[key]) {
      nextWeekWithData.push({ date: d, data: dataByDate[key] });
    }
  }

  if (nextWeekWithData.length) {
    res.write("<details><summary>Következő hét</summary>");
    nextWeekWithData.forEach(item => {
      res.write("<h3>" + iso(item.date) + " – " +
        capitalize(napNevek[item.date.getDay()]) + "</h3>");
      renderDay(res, item.data);
    });
    res.write("</details>");
  }

  /* ===== QR ===== */
  const baseUrl = req.protocol + "://" + req.get("host");
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write("<hr>");
  res.write("<h3>Honlap elérhetősége</h3>");
  res.write(`${qrUrl}<br>`);
  res.write("<p style='color:#555;'>~10s Server Wake-Up</p>");
  res.write("<p>" + baseUrl + "</p>");

  /* ===== ALÁÍRÁS ===== */
  res.write("<p style='text-align:center;font-size:0.8em;color:#777;'>by István Gris</p>");

  res.write("</body></html>");
  res.end();
});

app.listen(port, () =>
  console.log("Menü szerver fut – végleges megnevezésekkel és szűréssel")
);
``
