const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// ÍRD ÁT a sheet nevére, ahol az adatok vannak
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

app.get("/", async (req, res) => {
  try {
    const response = await fetch(CSV_URL);
    const text = await response.text();

    if (text.startsWith("<")) {
      return res.json({ error: "HTML jött CSV helyett" });
    }

    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    res.json({
      rowsCount: rows.length,
      rows
    });
  } catch (err) {
    res.json({
      error: err.message
    });
  }
});

app.listen(port, () => {
  console.log("CSV teszt szerver fut:", port);
});
