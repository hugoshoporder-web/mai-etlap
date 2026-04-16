const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// Sheet neve PONTOSAN
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* -------- SEGÉDFÜGGVÉNYEK -------- */

function normalizeNap(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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
const napKodok = [
  "vasarnap",
  "hetfo",
  "kedd",
  "szerda",
  "csutortok",
  "pentek",
  "szombat"
];

function getTodayHu() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );

  return {
    dateObj: now,
    datum: now.toISOString().split("T")[0],
    napNev: napNevek[now.getDay()],
    napKod: napKodok[now.getDay()],
    dayIndex: now.getDay()
  };
}

function getNextWorkday(fromDate) {
  let d = new Date(fromDate);
  while (true) {
    d.setDate(d.getDate() + 1);
    const idx = d.getDay();
    if (idx >= 1 && idx <= 5) return new Date(d);
  }
}

// ✅ KULCS: következő hét HÉTFŐ dátuma
function getNextWeekMonday(todayDate) {
  const d = new Date(todayDate);
  const day = d.getDay(); // 0=vas, 1=hétfő, ...
  const daysUntilNextMonday = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + daysUntilNextMonday);
  return d;
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

/* -------- FŐ ROUTE -------- */

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  // ➡️ EREDETI struktúra (mai + köv. munkanap)
  const data = {};
  // ➡️ ÚJ: dátum alapú index (következő hét)
  const dataByDate = {};

  rows.forEach(r => {
    const nap = normalizeNap(r.nap);
    const etterem = r.etterem || "Alap étterem";
    const tipus = r.tipus || "Egyéb";
    const etel = r.etel;
    if (!etel) return;

    if (!data[nap]) data[nap] = {};
    if (!data[nap][etterem]) data[nap][etterem] = {};
    if (!data[nap][etterem][tipus]) data[nap][etterem][tipus] = [];
    data[nap][etterem][tipus].push(etel);

    if (r.datum) {
      if (!dataByDate[r.datum]) dataByDate[r.datum] = {};
      if (!dataByDate[r.datum][etterem])
        dataByDate[r.datum][etterem] = {};
      if (!dataByDate[r.datum][etterem][tipus])
        dataByDate[r.datum][etterem][tipus] = [];
      dataByDate[r.datum][etterem][tipus].push(etel);
    }
  });

  const today = getTodayHu();
  const nextWorkdayDate = getNextWorkday(today.dateObj);

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Mai menü</title>");
  res.write("</head><body>");

  /* ---- MAI MENÜ ---- */
  res.write(
    "<h1>Mai menü (" +
      today.datum +
      " – " +
      capitalize(today.napNev) +
      ")</h1>"
  );
  renderDay(res, data[today.napKod]);

  /* ---- KÖVETKEZŐ MUNKANAP ---- */
  res.write("<hr>");
  res.write(
    "<h2>Következő munkanap (" +
      nextWorkdayDate.toISOString().split("T")[0] +
      " – " +
      capitalize(napNevek[nextWorkdayDate.getDay()]) +
      ")</h2>"
  );
  renderDay(
    res,
    data[normalizeNap(napNevek[nextWorkdayDate.getDay()])]
  );

  /* ---- KÖVETKEZŐ HÉT (HÉTFŐ → PÉNTEK) ---- */
  res.write("<hr>");
  res.write("<h2>Következő hét</h2>");

  const monday = getNextWeekMonday(today.dateObj);

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);

    const iso = d.toISOString().split("T")[0];
    const napNev = capitalize(napNevek[d.getDay()]);

    res.write("<h3>" + iso + " – " + napNev + "</h3>");
    renderDay(res, dataByDate[iso]);
  }

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
  console.log("Menü szerver fut – következő hét hétfőtől péntekig (TESZT)");
});
