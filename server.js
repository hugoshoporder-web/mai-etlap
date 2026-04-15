const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// ÁLLÍTSD BE pontosan a sheet nevét
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

// nap normalizálás (ékezet, nagybetű nem számít)
function normalizeNap(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// első betű nagybetű
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// magyar dátum + nap
function getTodayHuInfo() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );

  const napok = [
    "vasárnap",
    "hétfő",
    "kedd",
    "szerda",
    "csütörtök",
    "péntek",
    "szombat"
  ];

  const datum = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const napNev = napok[now.getDay()];
  const napKod = normalizeNap(napNev); // hetfo, kedd, stb.

  return { datum, napNev, napKod };
}

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const { datum, napNev, napKod } = getTodayHuInfo();

  // struktúra: etterem -> tipus -> [ételek]
  const data = {};

  rows.forEach(r => {
    const etterem = r.etterem || "Alap étterem";
    const nap = normalizeNap(r.nap);
    const tipus = r.tipus || "Egyéb";
    const etel = r.etel;

    if (nap !== napKod || !etel) return;

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

  res.write("<h1>Mai menü (" + datum + " – " + capitalize(napNev) + ")</h1>");

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
  console.log("Menü szerver fut:", port);
});
