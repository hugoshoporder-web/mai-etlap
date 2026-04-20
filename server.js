const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ===== SEGÉDFÜGGVÉNYEK ===== */

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

function formatISO(d) {
  return d.toISOString().split("T")[0];
}

function renderDay(res, dayData) {
  if (!dayData || Object.keys(dayData).length === 0) {
    res.write("<p><em>Nincs adat.</em></p>");
    return;
  }

  for (const etterem in dayData) {
    res.write("<h4>" + etterem + "</h4>");
    for (const tipus in dayData[etterem]) {
      res.write("<strong>" + tipus + "</strong><ul>");
      dayData[etterem][tipus].forEach(e =>
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

  // ✅ dátum‑alapú adat
  const dataByDate = {};
  rows.forEach(r => {
    if (!r.datum || !r.etel) return;
    const datum = r.datum;
    const etterem = r.etterem || "Alap étterem";
    const tipus = r.tipus || "Egyéb";

    if (!dataByDate[datum]) dataByDate[datum] = {};
    if (!dataByDate[datum][etterem]) dataByDate[datum][etterem] = {};
    if (!dataByDate[datum][etterem][tipus])
      dataByDate[datum][etterem][tipus] = [];

    dataByDate[datum][etterem][tipus].push(r.etel);
  });

  const today = todayHu();
  const monday = weekMonday(today);

  const todayOffset = Math.max(0, today.getDay() - 1);
  const nextOffset = todayOffset + 1;

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Heti menü</title>");
  res.write("</head><body>");

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  res.write("<h1>Heti menü (" + formatISO(monday) + " – " + formatISO(friday) + ")</h1>");

  /* --- KÖVETKEZŐ NAP --- */
  if (nextOffset < 5) {
    const nextDate = new Date(monday);
    nextDate.setDate(monday.getDate() + nextOffset);
    res.write("<h2>Következő nap (" + formatISO(nextDate) +
      " – " + capitalize(napNevek[nextDate.getDay()]) + ")</h2>");
    renderDay(res, dataByDate[formatISO(nextDate)]);
  }

  /* --- TÖBBI HÁTRALEVŐ NAP LENYÍLÓBAN --- */
  if (nextOffset + 1 < 5) {
    res.write("<details><summary>A hét további napjai</summary>");
    for (let i = nextOffset + 1; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      res.write("<h3>" + formatISO(d) +
        " – " + capitalize(napNevek[d.getDay()]) + "</h3>");
      renderDay(res, dataByDate[formatISO(d)]);
    }
    res.write("</details>");
  }

  /* ===== QR BLOKK – STABIL, NEM MÓDOSÍTJUK ===== */
  const baseUrl = req.protocol + "://" + req.get("host");
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write("<hr>");
  res.write("<h3>Honlap elérhetősége</h3>");
  res.write('<img src="' + qrUrl + '" alt="QR kód"><br>');
  res.write("<p style='font-size:0.9em;color:#555;'>A szerver felébredése néhány másodpercet igénybe vehet.</p>");
  res.write("<p>" + baseUrl + "</p>");

  res.write("</body></html>");
  res.end();
});

app.listen(port, () => {
  console.log("Menü szerver fut – következő nap + lenyíló hátralévő napok");
});
