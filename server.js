const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// Google Sheet CSV
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv";

async function getMenus() {
  try {
    const res = await fetch(CSV_URL + "&nocache=" + Date.now());
    const text = await res.text();

    if (text.startsWith("<")) return {};

    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const menus = {};
    rows.forEach(row => {
      menus[row.nap] = {
        a: row.menu_a,
        b: row.menu_b,
        gyerek: row.gyerek
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
    "szombat"
  ];

  const now = new Date().toLocaleString("hu-HU", {
    timeZone: "Europe/Budapest"
  });
  const today = napok[new Date(now).getDay()];

  const menus = await getMenus();
  const mai = menus[today];

  res.send(`
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mai menü</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f5f6fa;
      margin: 0;
      padding: 20px;
    }

    h1 {
      text-align: center;
      margin-bottom: 25px;
    }

    .menus {
      display: grid;
      grid-template-columns: 1fr;
      gap: 15px;
    }

    .menu-card {
      background: #ffffff;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.1);
      text-align: center;
    }

    .menu-card h2 {
      margin-top: 0;
      font-size: 1.4rem;
    }

    .menu-card p {
      font-size: 1.2rem;
      margin: 10px 0 0;
    }

    /* 💻 nagyobb képernyő: oszlopok */
    @media (min-width: 768px) {
      .menus {
        grid-template-columns: repeat(3, 1fr);
      }
    }
  </style>
</head>

<body>

  <h1>Mai menü</h1>

  ${
    mai
      ? `
