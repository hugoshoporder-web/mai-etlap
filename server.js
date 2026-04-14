const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv";

async function getData() {
  try {
    const res = await fetch(CSV_URL + "&nocache=" + Date.now());
    const text = await res.text();

    if (text.startsWith("<")) return {};

    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const data = {};

    rows.forEach(r => {
      const etterem = r.etterem;
      const nap = r.nap;
      const etel = r.etel;

      if (!data[etterem]) data[etterem] = {};
      if (!data[etterem][nap]) data[etterem][nap] = [];

      data[etterem][nap].push(etel);
    });

    return data;
  } catch (e) {
    console.error("Hiba:", e.message);
    return {};
  }
}

app.get("/", async (req, res) => {
  const napok = ["vasarnap","hetfo","kedd","szerda","csutortok","pentek","szombat"];
  const now = new Date().toLocaleString("hu-HU",{ timeZone:"Europe/Budapest" });
  const today = napok[new Date(now).getDay()];

  const data = await getData();

  res.send(`
<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mai kínálat</title>

<style>
body { font-family: Arial; background:#f5f6fa; padding:20px }
.et { margin-bottom:30px }
.cards { display:grid; grid-template-columns:1fr; gap:10px }
@media(min-width:768px){
  .cards { grid-template-columns:repeat(auto-fit,minmax(220px,1fr)) }
}
.card {
  background:white;
  padding:15px;
  border-radius:8px;
  box-shadow:0 2px 6px rgba(0,0,0,.1)
}
</style>
</head>

<body>
<h1>Mai kínálat</h1>

${
  Object.entries(data).map(([etterem, napok]) => {
    const etelek = napok[today];
    if (!etelek) return "";

    return `
      <div class="et">
        <h2>${etterem}</h2>
        <div class="cards">
          ${etelek.map(e => `<div class="card">${e}</div>`).join("")}
        </div>
      </div>
    `;
  }).join("")
}

</body>
</html>
`);
});

app.listen(port, () => console.log("Server fut:", port));
