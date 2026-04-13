const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// Google Sheet CSV link (a te táblázatodé!)
const CSV_URL = "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv";

async function getMenu() {
  try {
    const response = await fetch(CSV_URL + "&nocache=" + Date.now());
    const csvText = await response.text();

    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const menu = {};

    for (const row of rows) {
      const nap = row.nap?.trim().toLowerCase();
      const etel = row.menu?.trim();

      if (nap && etel) {
        menu[nap] = etel;
      }
    }

    return menu;

  } catch (err) {
    console.error("CSV parse hiba:", err.message);
    return {};
  }
}

app.get("/", async (req, res) => {
  const napok = [
    "vasarnap",
    "hetfo",
    "kedd",
    "szerda",
    "csutortok",
    "pentek",
    "szombat"
  ];

  const now = new Date().toLocaleString("hu-HU", { timeZone: "Europe/Budapest" });
  const today = napok[new Date(now).getDay()];

  const menu = await getMenu();
  const maiMenu = menu[today] || "Nincs adat ma";

  res.send(`
    <html lang="hu">
      <head><meta charset="UTF-8"><title>Mai étlap</title></head>
      <body>
        <h1>Mai menü</h1>
        <div>${maiMenu}</div>
      </body>
    </html>
  `);
});

app.listen(port, () => console.log("Server fut:", port));
