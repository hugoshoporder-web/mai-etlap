const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

const napNevek = ["vasárnap","hétfő","kedd","szerda","csütörtök","péntek","szombat"];

function todayHu() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
}

function iso(d) {
  return d.toISOString().split("T")[0];
}

function renderDay(res, dayData) {
  for (const tipus in dayData) {
    res.write("<strong>" + tipus + "</strong><ul>");
    dayData[tipus].forEach(etel =>
      res.write("<li>" + etel + "</li>")
    );
    res.write("</ul>");
  }
}

app.get("/", async (req, res) => {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

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
  const todayIso = iso(today);

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Heti menü</title>");

  res.write(`
    <style>
      body { font-family: system-ui, sans-serif; margin: 1em; }
      ul { list-style:none; padding-left:1.2em; margin:0.2em 0; }
      li { line-height:1.3; }
      li::before { content:"– "; }
    </style>
  `);

  res.write("</head><body>");

  res.write("<h1>Heti menü, " + etteremNev + "</h1>");

  if (dataByDate[todayIso]) {
    res.write("<h2>Mai nap</h2>");
    renderDay(res, dataByDate[todayIso]);
  }

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = iso(tomorrow);

  if (dataByDate[tomorrowIso]) {
    res.write("<h2>Következő nap</h2>");
    renderDay(res, dataByDate[tomorrowIso]);
  }

  res.write("</body></html>");
  res.end();
});

app.listen(port, () =>
  console.log("Menü szerver fut")
);
