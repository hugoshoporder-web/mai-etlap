const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// Google Sheet CSV
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv";

/**
 * Nap normalizálása:
 * - kisbetű
 * - ékezet eltávolítás
 * - szóköz levágás
 */
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

    // Ha HTML jönne vissza, az nem adat
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
