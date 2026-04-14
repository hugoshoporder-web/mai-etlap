const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// Google Sheet CSV (1 sor = 1 étel)
const CSV_URL =
"https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=Munkalap1";

// nap normalizálás (ékezet, nagybetű, elütés nem számít)
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

    // ha HTML jön vissza, akkor nincs adat
    if (text.startsWith("<")) return {};

    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const data = {};

    rows.forEach(r => {
      const etterem = r.etterem?.trim();
      const nap = normalizeNap(r.nap);
      const etel = r.etel?.trim();

      if (!etterem || !nap || !etel) return;

      if (!data[etterem]) data[etterem] = {};
      if (!data[etterem][nap]) data[etterem][nap] = [];

      data[etterem][nap].push(etel);
    });

    return data;
  } catch (e) {
    console.error("Adat hiba:", e.message);
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

  const now = new Date().toLocaleString("hu-HU", {
    timeZone: "Europe/Budapest"
  });
  const today = napok[new Date(now).getDay()];

  const data = await getData();

  res.send(`
<!DOCTYPE html>
<html lang="hu">
