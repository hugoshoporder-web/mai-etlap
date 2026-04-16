const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// CSV export – normál URL, NINCS &amp;
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ---------- SEGÉDFÜGGVÉNYEK ---------- */

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const napNevek = [
  "vasárnap",
  "hétfő",
  "kedd",
  "szerda",
  "csütörtök",
  "péntek",
  "szombat"
];

function getTodayHu() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );

  return {
    dateObj: now,
    iso: now.toISOString().split("T")[0],
    napNev: napNevek[now.getDay()]
  };
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
   * ✅ ÚJ ADATMODELL:
   * datum (YYYY-MM-DD) -> etterem -> tipus -> ételek[]
   */
  const dataByDate = {};

  rows.forEach(r => {
    if (!r.datum || !r.etel) return;

    const datum = r.datum;
    const etterem = r.etterem || "Alap étterem";
    const tipus = r.tipus || "Egyéb";

    if (!dataByDate[datum]) dataByDate[datum] = {};
    if (!dataByDate[datum][etterem]) {
      dataByDate[datum][etterem] = {};
    }
    if (!dataByDate[datum][etterem][tipus]) {
      dataByDate[datum][etterem][tipus] = [];
    }

    dataByDate[datum][etterem][tipus].push(r.etel);
  });

  const today = getTodayHu();

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Mai menü</title>");
  res.write("</head><body>");

  /* ---- MAI MENÜ (DÁTUM ALAPON) ---- */
  res.write(
    "<h1>Mai menü (" +
      today.iso +
      " – " +
      capitalize(today.napNev) +
      ")</h1>"
  );
  renderDay(res, dataByDate[today.iso]);

  /* ---- QR + MEGJEGYZÉS ---- */
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
  console.log("Menü szerver fut – v1 DATE ALAP");
});
