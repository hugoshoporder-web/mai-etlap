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

function getTodayHu() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
}

function getWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=vas, 1=hétfő
  const diff = day === 0 ? -6 : 1 - day;
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
      res.write("<strong>" + tipus + "</strong>");
      res.write("<ul>");
      dayData[etterem][tipus].forEach(e =>
        res.write("<li>" + e + "</li>")
      );
      res.write("</ul>");
    }
  }
}

/* ===== ROUTE ===== */

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  // ✅ dátum-alapú adat
  const dataByDate = {};

  rows.forEach(r => {
    if (!r.datum || !r.etel) return;

    const datum = r.datum;
    const etterem = r.etterem || "Alap étterem";
    const tipus = r.tipus || "Egyéb";
    const etel = r.etel;

    if (!dataByDate[datum]) dataByDate[datum] = {};
    if (!dataByDate[datum][etterem]) dataByDate[datum][etterem] = {};
    if (!dataByDate[datum][etterem][tipus])
      dataByDate[datum][etterem][tipus] = [];

    dataByDate[datum][etterem][tipus].push(etel);
  });

  const today = getTodayHu();
  const monday = getWeekMonday(today);

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Heti menü</title>");
  res.write("</head><body>");

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  res.write(
    "<h1>Heti menü (" +
      formatISO(monday) +
      " – " +
      formatISO(friday) +
      ")</h1>"
  );

  /* ---- CSAK A HÉT HÁTRALEVŐ NAPJAI ---- */
  const todayDayIndex = today.getDay(); // 1=hétfő
  const startOffset = Math.max(0, todayDayIndex - 1);

  for (let i = startOffset; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = formatISO(d);
    const napNev = capitalize(napNevek[d.getDay()]);

    res.write("<h2>" + iso + " – " + napNev + "</h2>");
    renderDay(res, dataByDate[iso]);
  }

  /* ---- QR ---- */
  const baseUrl = req.protocol + "://" + req.get("host");
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write("<hr>");
  res.write("<h3>Honlap elérhetősége</h3>");
  res.write('' + qrUrl + '<br>');
  res.write(
    "<p style='font-size:0.9em;color:#555;'>A szerver felébredése néhány másodpercet igénybe vehet.</p>"
  );
  res.write("<p>" + baseUrl + "</p>");

  res.write("</body></html>");
  res.end();
});

app.listen(port, () => {
  console.log("Menü szerver fut – aktuális hét hátralévő napjai");
});
