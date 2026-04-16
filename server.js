const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// CSV export – helyes URL
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ---------- SEGÉDFÜGGVÉNYEK ---------- */

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
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
  return {
    dateObj: now,
    iso: now.toISOString().split("T")[0],
    napNev: napNevek[now.getDay()],
    dayIndex: now.getDay()
  };
}

function getNextWorkdayHu(fromDate) {
  const d = new Date(fromDate);
  while (true) {
    d.setDate(d.getDate() + 1);
    const idx = d.getDay(); // 1–5 = H–P
    if (idx >= 1 && idx <= 5) {
      return {
        dateObj: new Date(d),
        iso: d.toISOString().split("T")[0],
        napNev: napNevek[idx]
      };
    }
  }
}

function renderDay(res, dayData) {
  if (!dayData || Object.keys(dayData).length === 0) {
    res.write("<p><em>Nincs adat.</em></p>");
    return;
  }

  for (const etterem in dayData) {
    res.write("<h3>" + etterem + "</h3>");
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

/* ---------- FŐ ROUTE ---------- */

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  /**
   * ✅ DÁTUM-ALAPÚ ADATSTRUKTÚRA
   * datum -> etterem -> tipus -> ételek[]
   */
  const dataByDate = {};

  rows.forEach(r => {
    if (!r.datum || !r.etel) return;

    const datum = r.datum; // pl. 2026-04-17
    const etterem = r.etterem || "Alap étterem";
    const tipus = r.tipus || "Egyéb";

    if (!dataByDate[datum]) dataByDate[datum] = {};
    if (!dataByDate[datum][etterem])
      dataByDate[datum][etterem] = {};
    if (!dataByDate[datum][etterem][tipus])
      dataByDate[datum][etterem][tipus] = [];

    dataByDate[datum][etterem][tipus].push(r.etel);
  });

  const today = getTodayHu();
  const nextDay = getNextWorkdayHu(today.dateObj);

  /* ---------- HTML ---------- */

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Mai menü</title>");
  res.write("</head><body>");

  /* ---- MAI MENÜ ---- */
  res.write(
    "<h1>Mai menü (" +
      today.iso +
      " – " +
      capitalize(today.napNev) +
      ")</h1>"
  );
  renderDay(res, dataByDate[today.iso]);

  /* ---- KÖVETKEZŐ MUNKANAP ---- */
  res.write("<hr>");
  res.write(
    "<h2>Következő munkanap (" +
      nextDay.iso +
      " – " +
      capitalize(nextDay.napNev) +
      ")</h2>"
  );
  renderDay(res, dataByDate[nextDay.iso]);

  /* ---- QR + MEGJEGYZÉS ---- */
  const baseUrl = req.protocol + "://" + req.get("host");
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write("<hr>");
  res.write("<h3>Honlap elérhetősége</h3>");
  res.write('<img src="' + qrUrl + '" alt="QR kód"><br>');
  res.write(
    "<p style='font-size:0.9em;color:#555;'>A szerver felébredése néhány másodpercet igénybe vehet.</p>"
  );
  res.write("<p>" + baseUrl + "</p>");

  res.write("</body></html>");
  res.end();
});

app.listen(port, () => {
  console.log("Menü szerver fut – dátum alap + következő munkanap");
});
