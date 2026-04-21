const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ===== SEGÉD ===== */

const napNevek = [
  "vasárnap",
  "hétfő",
  "kedd",
  "szerda",
  "csütörtök",
  "péntek",
  "szombat"
];

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

function renderDay(res, d) {
  if (!d || Object.keys(d).length === 0) {
    res.write("<p><em>Nincs adat.</em></p>");
    return;
  }
  for (const etterem in d) {
    res.write("<h4>" + etterem + "</h4>");
    for (const tipus in d[etterem]) {
      res.write("<strong>" + tipus + "</strong><ul>");
      d[etterem][tipus].forEach(e =>
        res.write("<li>" + e + "</li>")
      );
      res.write("</ul>");
    }
  }
}

/* ===== ROUTE ===== */

app.get("/", async (req, res) => {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

  const dataByDate = {};
  rows.forEach(r => {
    if (!r.datum || !r.etel) return;
    dataByDate[r.datum] ??= {};
    dataByDate[r.datum][r.etterem] ??= {};
    dataByDate[r.datum][r.etterem][r.tipus] ??= [];
    dataByDate[r.datum][r.etterem][r.tipus].push(r.etel);
  });

  const today = todayHu();
  const monday = weekMonday(today);

  const todayOffset = Math.max(0, today.getDay() - 1);
  const nextOffset = todayOffset + 1;

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Heti menü</title>");

  /* ===== GOOGLE ANALYTICS (gtag.js) ===== */
  res.write(`
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-92VX8WYT6W"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-92VX8WYT6W');
    </script>
  `);

  /* ===== LISTASŰRÍTÉS + VONAL JEL ===== */
  res.write(`
    <style>
      ul {
        margin-top: 0.2em;
        margin-bottom: 0.4em;
        padding-left: 1.2em;
        list-style: none;
      }
      li {
        margin: 0;
        line-height: 1.2;
      }
      li::before {
        content: "– ";
      }
    </style>
  `);

  res.write("</head><body>");

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  res.write("<h1>Heti menü (" + iso(monday) + " – " + iso(friday) + ")</h1>");

  /* ===== MAI NAP ===== */
  res.write("<h2>Mai nap (" + iso(today) + " – " + capitalize(napNevek[today.getDay()]) + ")</h2>");
  renderDay(res, dataByDate[iso(today)]);

  /* ===== KÖVETKEZŐ NAP ===== */
  if (nextOffset < 5) {
    const nextDate = new Date(monday);
    nextDate.setDate(monday.getDate() + nextOffset);
    res.write("<h2>Következő nap (" +
      iso(nextDate) + " – " +
      capitalize(napNevek[nextDate.getDay()]) + ")</h2>");
    renderDay(res, dataByDate[iso(nextDate)]);
  }

  /* ===== AKTUÁLIS HÉT TOVÁBBI NAPJAI ===== */
  if (nextOffset + 1 < 5) {
    res.write("<details><summary>A hét további napjai</summary>");
    for (let i = nextOffset + 1; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      res.write("<h3>" + iso(d) + " – " + capitalize(napNevek[d.getDay()]) + "</h3>");
      renderDay(res, dataByDate[iso(d)]);
    }
    res.write("</details>");
  }

  /* ===== KÖVETKEZŐ HÉT (ha van adat) ===== */
  const nextWeekMonday = new Date(monday);
  nextWeekMonday.setDate(monday.getDate() + 7);

  let hasNextWeekData = false;
  const nextWeekDays = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(nextWeekMonday);
    d.setDate(nextWeekMonday.getDate() + i);
    nextWeekDays.push(d);
    if (dataByDate[iso(d)]) hasNextWeekData = true;
  }

  if (hasNextWeekData) {
    res.write("<details><summary>Következő hét</summary>");
    nextWeekDays.forEach(d => {
      res.write("<h3>" + iso(d) + " – " + capitalize(napNevek[d.getDay()]) + "</h3>");
      renderDay(res, dataByDate[iso(d)]);
    });
    res.write("</details>");
  }

  /* ===== QR BLOKK – VÁLTOZATLAN ===== */
  const baseUrl = req.protocol + "://" + req.get("host");
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write("<hr>");
  res.write("<h3>Honlap elérhetősége</h3>");
  res.write(`<img src="${qrUrl}" alt="QR kód"><br>`);
  res.write("<p style='font-size:0.9em;color:#555;'>A szerver felébredése néhány másodpercet igénybe vehet.</p>");
  res.write("<p>" + baseUrl + "</p>");

  /* ===== ALÁÍRÁS ===== */
  res.write("<p style='text-align:center;font-size:0.8em;color:#777;margin-top:1em;'>by István Gris</p>");

  res.write("</body></html>");
  res.end();
});

app.listen(port, () =>
  console.log("Menü szerver fut – GA beillesztve")
);
