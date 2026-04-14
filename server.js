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

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const napok = ["vasarnap","hetfo","kedd","szerda","csutortok","pentek","szombat"];
  const today = napok[new Date().getDay()];

  const result = {};

  rows.forEach(r => {
    const etterem = r.etterem || "Alap étterem";
    const nap = normalizeNap(r.nap);
    const etel = r.etel;
    if (nap !== today || !etel) return;

    if (!result[etterem]) result[etterem] = [];
    result[etterem].push(etel);
  });

  res.json({
    today,
    data: result
  });
});

app.listen(port, () => console.log("OK"));
