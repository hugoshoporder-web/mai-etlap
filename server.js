const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv";

async function getMenus() {
  try {
    const res = await fetch(CSV_URL + "&nocache=" + Date.now());
    const csvText = await res.text();

    if (csvText.startsWith("<")) return {};

    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const menus = {};
    rows.forEach(row => {
      menus[row.nap] = {
        a: row.menu_a,
        b: row.menu_b,
        gyerek: row.gyerek,
      };
    });

    return menus;
  } catch (e) {
    console.error("Hiba:", e.message);
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
    "szombat",
  ];

  const now = new Date().toLocaleString("hu-HU", {
    timeZone: "Europe/Budapest",
  });
  const today = napok[new Date(now).getDay()];

  const menus = await getMenus();
  const mai = menus[today];

  res.send(`
    <html lang="hu">
    <head>
      <meta charset="UTF-8">
      <title>Mai menü</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        h2 { margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Mai menü</h1>

      ${mai ? `
        <h2>A menü</h2>
        <p>${mai.a}</p>

        <h2>B menü</h2>
        <p>${mai.b}</p>

        <h2>Gyerek menü</h2>
        <p>${mai.gyerek}</p>
      ` : "<p>Nincs adat ma</p>"}

    </body>
    </html>
  `);
});

app.listen(port, () => console.log("Server fut:", port));
