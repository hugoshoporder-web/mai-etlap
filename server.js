const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* -------- SEGÉDFÜGGVÉNYEK -------- */

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getHuDate(offset = 0) {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
  d.setDate(d.getDate() + offset);

  const napNevek = [
    "vasárnap","hétfő","kedd","szerda",
    "csütörtök","péntek","szombat"
  ];

  return {
    iso: d.toISOString().split("T")[0],
    napNev: napNevek[d.getDay()],
    napIndex: d.getDay()
  };
}

function isWorkday(index) {
  return index >= 1 && index <= 5;
}

function renderDay(res, dayData) {
  if (!dayData) {
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

/* -------- FŐ ROUTE -------- */

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  // ✅ ADAT DÁTUM ALAPON
  const dataByDate = {};
  rows.forEach(r => {
    if (!r.datum || !r.etel) return;

    if (!dataByDate[r.datum]) dataByDate[r.datum] = {};
    const etterem = r.etterem || "Alap étterem";
    const tipus = r.tipus || "Egyéb";

    if (!dataByDate[r.datum][etterem])
      dataByDate[r.datum][etterem] = {};
    if (!dataByDate[r.datum][etterem][tipus])
      dataByDate[r.datum][etterem][tipus] = [];

    dataByDate[r.datum][etterem][tipus].push(r.etel);
  });

  const today = getHuDate(0);

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Mai menü</title></head><body>");

  /* ---- MAI ---- */
  res.write(`<h1>Mai menü (${today.iso} – ${capitalize(today.napNev)})</h1>`);
  renderDay(res, dataByDate[today.iso]);

  /* ---- KÖVETKEZŐ MUNKANAP ---- */
  let offset = 1;
  let next;
  while (offset < 14) {
    const d = getHuDate(offset);
    if (isWorkday(d.napIndex)) {
      next = d;
      break;
    }
    offset++;
  }

  if (next) {
    res.write(`<hr><h2>Következő munkanap (${next.iso} – ${capitalize(next.napNev)})</h2>`);
    renderDay(res, dataByDate[next.iso]);
  }

  /* ---- TOVÁBBIAK: CSAK DÁTUM SZERINT ---- */
  res.write("<hr><details><summary><strong>A hét további napjai</strong></summary>");

  for (let i = offset + 1; i <= offset + 7; i++) {
    const d = getHuDate(i);
    if (!isWorkday(d.napIndex)) continue;

    res.write(`<h3>${d.iso} – ${capitalize(d.napNev)}</h3>`);
    renderDay(res, dataByDate[d.iso]);
  }

  res.write("</details></body></html>");
  res.end();
});

app.listen(port, () => {
  console.log("Menü szerver fut (dátum‑alapú):", port);
});
