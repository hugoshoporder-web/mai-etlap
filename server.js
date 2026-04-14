const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

function normalizeNap(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function getData() {
  const res = await fetch(CSV_URL);
  const text = await res.text();

  if (text.startsWith("<")) return {};

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const data = {};

  rows.forEach(r => {
    const etterem = (r.etterem || "Alap étterem").trim();
    const nap = normalizeNap(r.nap);
    const etel = r.etel?.trim();
    if (!nap || !etel) return;

    if (!data[etterem]) data[etterem] = {};
    if (!data[etterem][nap]) data[etterem][nap] = [];
    data[etterem][nap].push(etel);
  });

  return data;
}

app.get("/", async (req, res) => {
  const napok = ["vasarnap","hetfo","kedd","szerda","csutortok","pentek","szombat"];
  const today = napok[new Date().getDay()];
  const data = await getData();

  let html = `
<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mai menü</title>
<style>
body { font-family: Arial; background:#f5f6fa; padding:20px }
.card { background:#fff; padding:10px; margin-bottom:10px; border-radius:6px }
</style>
</head>
<body>
<h1>Mai menü</h1>
`;

  let vanAdat = false;

  for (const etterem in data) {
    const etelek = data[etterem][today];
    if (!etelek) continue;
    vanAdat = true;
    html += `<h2>${etterem}</h2>`;
    etelek.forEach(e => {
      html += `<div class="card">${e}</div>`;
    });
  }

  if (!vanAdat) html += "<p>Nincs adat ma</p>";

  html += `
</body>
</html>
`;

  res.send(html);
});

app.listen(port, () => {
  console.log("Server fut:", port);
});
