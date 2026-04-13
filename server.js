const express = require("express");
const fetch = require("node-fetch");

const app = express();
const port = process.env.PORT || 3000;

// Google Sheet ID
const SHEET_ID = "1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

async function getMenu() {
  // Friss adatok minden lekérésnél
  const url = `${SHEET_URL}&nocache=${Date.now()}`;
  const response = await fetch(url);
  const text = await response.text();

  // Google Visualization JSON fix
  const clean = text
    .replace("/*O_o*/", "")
    .replace("google.visualization.Query.setResponse(", "")
    .slice(0, -2);

  const json = JSON.parse(clean);
  const rows = json.table.rows;

  const menu = {};
  rows.forEach(row => {
    const nap = row.c[0].v;
    const fogas = row.c[1].v;
    menu[nap] = fogas;
  });

  return menu;
}

app.get("/", async (req, res) => {
  const napok = ["vasarnap","hetfo","kedd","szerda","csutortok","pentek","szombat"];

  const now = new Date().toLocaleString("hu-HU", { timeZone: "Europe/Budapest" });
  const today = napok[new Date(now).getDay()];

  const menu = await getMenu();
  const maiMenu = menu[today] || "Nincs adat ma";

  res.send(`
    <!DOCTYPE html>
    <html lang="hu">
    <head>
      <meta charset="UTF-8">
      <title>Mai étlap</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        h1 { color: #2c3e50; }
      </style>
    </head>
    <body>
      <h1>Mai menü</h1>
      <div>${maiMenu}</div>
    </body>
    </html>
  `);
});

app.listen(port, () => console.log(`Fut: http://localhost:${port}`));
