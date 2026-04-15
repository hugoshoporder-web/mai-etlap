const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// pontosan a sheet neve!
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

function normalizeNap(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getTodayHu() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
  const napok = ["vasarnap","hetfo","kedd","szerda","csutortok","pentek","szombat"];
  return napok[now.getDay()];
}

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const today = getTodayHu();

  // struktúra: etterem -> tipus -> [ételek]
  const data = {};

  rows.forEach(r => {
    const etterem = r.etterem || "Alap étterem";
    const nap = normalizeNap(r.nap);
    const tipus = r.tipus || "Egyéb";
    const etel = r.etel;

    if (nap !== today || !etel) return;

    if (!data[etterem]) data[etterem] = {};
    if (!data[etterem][tipus]) data[etterem][tipus] = [];

    data[etterem][tipus].push(etel);
  });

  // ---- HTML KIÍRÁS ----
  res.write("<!DOCTYPE html>");
  res.write("<html lang='hu'>");
  res.write("<head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Mai menü</title>");
  res.write("</head>");
  res.write("<body>");
  res.write("<h1>Mai menü</h1>");

  let vanAdat = false;

  for (const etterem in data) {
    vanAdat = true;
    res.write("<h2>" + etterem + "</h2>");

    const csoportok = data[etterem];
    for (const tipus in csoportok) {
      res.write("<h3>" + tipus + "</h3>");
      res.write("<ul>");
      csoportok[tipus].forEach(e => {
        res.write("<li>" + e + "</li>");
      });
      res.write("</ul>");
    }
  }

  if (!vanAdat) {
    res.write("<p>Nincs adat ma</p>");
  }

  res.write("</body>");
  res.write("</html>");
  res.end();
});

app.listen(port, () => {
  console.log("Csoportosított menü szerver fut:", port);
});
