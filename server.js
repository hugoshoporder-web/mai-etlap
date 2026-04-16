const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// ⬇️ PONTOSAN add meg a sheet nevét
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ---------------- SEGÉDFÜGGVÉNYEK ---------------- */

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

function getHuDate(offsetDays = 0) {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
  d.setDate(d.getDate() + offsetDays);

  const napNevek = [
    "vasárnap", "hétfő", "kedd", "szerda",
    "csütörtök", "péntek", "szombat"
  ];
  const napKodok = [
    "vasarnap", "hetfo", "kedd", "szerda",
    "csutortok", "pentek", "szombat"
  ];

  return {
    datum: d.toISOString().split("T")[0],
    napNev: napNevek[d.getDay()],
    napKod: napKodok[d.getDay()],
    napIndex: d.getDay()
  };
}

function isWorkday(index) {
  return index >= 1 && index <= 5;
}

function renderDay(res, dayData) {
  if (!dayData) {
    res.write("<p>Nincs adat</p>");
    return;
  }

  for (const etterem in dayData) {
    res.write("<h4>" + etterem + "</h4>");
    for (const tipus in dayData[etterem]) {
      res.write("<strong>" + tipus + "</strong>");
      res.write("<ul>");
      dayData[etterem][tipus].forEach(e => {
        res.write("<li>" + e + "</li>");
      });
      res.write("</ul>");
    }
  }
}

/* ---------------- FŐ ROUTE ---------------- */

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  // adat: nap -> etterem -> tipus -> ételek
  const data = {};
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
  });

  const today = getHuDate(0);

  // következő munkanap
  let offset = 1;
  while (!isWorkday(getHuDate(offset).napIndex)) offset++;
  const nextDay = getHuDate(offset);

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Mai menü</title>");
  res.write("</head><body>");

  /* --------- MAI MENÜ --------- */
  res.write("<h1>Mai menü (" + today.datum + " – " + capitalize(today.napNev) + ")</h1>");
  renderDay(res, data[today.napKod]);

  /* --------- KÖVETKEZŐ MUNKANAP --------- */
  res.write("<hr>");
  res.write("<h2>Következő munkanap (" + nextDay.datum + " – " + capitalize(nextDay.napNev) + ")</h2>");
  renderDay(res, data[nextDay.napKod]);

  /* --------- TOVÁBBI NAPOK --------- */
  res.write("<hr>");
  res.write("<details><summary><strong>A hét további napjai</strong></summary>");

  const shown = new Set([today.datum, nextDay.datum]);
  let futureOffset = offset + 1;
  let shownCount = 0;

  while (shownCount < 5) {
    const d = getHuDate(futureOffset++);
    if (!isWorkday(d.napIndex)) continue;
    if (shown.has(d.datum)) continue;

    if (data[d.napKod]) {
      res.write("<h3>" + d.datum + " – " + capitalize(d.napNev) + "</h3>");
      renderDay(res, data[d.napKod]);
      shown.add(d.datum);
      shownCount++;
    }
  }

  res.write("</details>");

  /* --------- QR KÓD + MEGJEGYZÉS (VÉGÉN, VÁLTOZATLAN) --------- */
  const baseUrl = req.protocol + "://" + req.get("host");
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write("<hr>");
  res.write("<h3>Honlap elérhetősége</h3>");
  res.write("<img src='" + qrUrl + "' alt='QR kód'>");
  res.write("<p style='font-size:0.9em;color:#555;'>A szerver felébredése néhány másodpercet igénybe vehet.</p>");
  res.write("<p>" + baseUrl + "</p>");

  res.write("</body></html>");
  res.end();
});

app.listen(port, () => {
  console.log("Menü szerver fut:", port);
});
