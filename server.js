const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

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

function getHuDateInfo(offsetDays = 0) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
  now.setDate(now.getDate() + offsetDays);

  const napNevek = [
    "vasárnap","hétfő","kedd","szerda","csütörtök","péntek","szombat"
  ];
  const kodok = [
    "vasarnap","hetfo","kedd","szerda","csutortok","pentek","szombat"
  ];

  return {
    datum: now.toISOString().split("T")[0],
    napNev: napNevek[now.getDay()],
    napKod: kodok[now.getDay()],
    napIndex: now.getDay()
  };
}

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const today = getHuDateInfo(0);

  // következő munkanap meghatározása
  let nextWorkdayOffset = 1;
  while ([0,6].includes(getHuDateInfo(nextWorkdayOffset).napIndex)) {
    nextWorkdayOffset++;
  }
  const nextDay = getHuDateInfo(nextWorkdayOffset);

  // adatstruktúra: nap -> etterem -> tipus -> etel
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

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Mai menü</title></head><body>");

  // ===== MAI =====
  res.write(`<h1>Mai menü (${today.datum} – ${capitalize(today.napNev)})</h1>`);
  renderDay(res, data[today.napKod]);

  // ===== KÖVETKEZŐ MUNKANAP =====
  res.write(`<hr><h2>Következő munkanap (${capitalize(nextDay.napNev)})</h2>`);
  renderDay(res, data[nextDay.napKod]);

  // ===== TELJES HÉT (ÖSSZECSUKHATÓ) =====
  res.write("<hr><details><summary><strong>A hét további napjai</strong></summary>");
  const maradekNapok = ["hetfo","kedd","szerda","csutortok","pentek"];

  maradekNapok.forEach(napKod => {
    if (napKod === today.napKod || napKod === nextDay.napKod) return;
    if (data[napKod]) {
      res.write(`<h3>${capitalize(napKod)}</h3>`);
      renderDay(res, data[napKod]);
    }
  });
  res.write("</details>");

  res.write("</body></html>");
  res.end();
});

function renderDay(res, dayData) {
  if (!dayData) {
    res.write("<p>Nincs adat</p>");
    return;
  }
  for (const etterem in dayData) {
    res.write(`<h3>${etterem}</h3>`);
    for (const tipus in dayData[etterem]) {
      res.write(`<strong>${tipus}</strong><ul>`);
      dayData[etterem][tipus].forEach(e =>
        res.write(`<li>${e}</li>`)
      );
      res.write("</ul>");
    }
  }
}

app.listen(port, () =>
  console.log("Menü szerver fut:", port)
);
``
