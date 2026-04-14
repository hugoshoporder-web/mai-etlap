const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// Google Sheet CSV – figyelj: ÍRD ÁT a SHEET nevét, ha nem ez!
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

function normalizeNap(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function getData() {
  try {
    const res = await fetch(CSV_URL + "&nocache=" + Date.now());
    const text = await res.text();

    if (text.startsWith("<")) {
      console.error("HTML jött vissza CSV helyett");
      return {};
    }

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
  } catch (e) {
    console.error("Adat feldolgozási hiba:", e);
    return {};
  }
}

app.get("/", async (req, res) => {
  const napok = [
    "vasarnap",
    "hetfo",
    "kedd",
    "szerda",
