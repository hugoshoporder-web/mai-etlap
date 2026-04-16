const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// ⚠️ Sheet neve legyen pontos
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ---------- SEGÉDFÜGGVÉNYEK ---------- */

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getHuDate(offsetDays = 0) {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
  d.setDate(d.getDate() + offsetDays);

  const napNevek = [
    "vasárnap", "hétfő", "kedd", "szerda",
    "csütörtök", "péntek", "szombat"
  ];

  return {
    iso: d.toISOString().split("T")[0], // YYYY-MM-DD
    napNev: napNevek[d.getDay()],
    napIndex: d.getDay()
  };
}

function isWorkday(dayIndex) {
  return dayIndex >= 1 && dayIndex <= 5;
}

function renderDay(res, dayData) {
  if (!dayData || Object.keys(dayData).length === 0) {
    res.write("<p><em>Nincs adat.</em></p>");
    return;
  }

  for (const etterem in dayData) {
    res.write("<h4>" + etterem + "</h4>");
    for (const tipus in dayData[etterem]) {
      res.write("<strong>" + tipus + "</strong>");
      res.write("<ul>");
      dayData[etterem][tipus].forEach(e =>
        res.write("<li>" + e + "</li>")
      );
      res.write("</ul>");
    }
  }
}

/* ---------- FŐ ROUTE ---------- */

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  /**
   * ADATSTRUKTÚRA:
   * datum (YYYY-MM-DD) -> etterem -> tipus -> ételek[]
   */
  const dataByDate = {};

  rows.forEach(r => {
    const datum = r.datum;
    if (!datum) return;

    const etterem = r.etterem || "Alap étterem";
    const tipus = r.tipus || "Egyéb";
    const etel = r.etel;

    if (!etel) return;

    if (!dataByDate[datum]) dataByDate[datum] = {};
    if (!dataByDate[datum][etterem]) dataByDate[datum][etterem] = {};
    if (!dataByDate[datum][etterem][tipus])
      dataByDate[datum][etterem][tipus] = [];

    dataByDate[datum][etterem][tipus].push(etel);
  });

  const today = getHuDate(0);

  /* ---------- KÖVETKEZŐ MUNKANAP ---------- */
  let offset = 1;
  let nextWorkday;
  while (offset < 14) {
    const d = getHuDate(offset);
    if (isWorkday(d.napIndex)) {
      nextWorkday = d;
      break;
    }
    offset++;
  }

  /* ---------- HTML ---------- */

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Mai menü</title></head><body>");

  /* ----- MAI ----- */
  res.write(
    "<h1>Mai menü (" +
      today.iso +
      " – " +
      capitalize(today.napNev) +
      ")</h1>"
  );
  renderDay(res, dataByDate[today.iso]);

  /* ----- KÖVETKEZŐ MUNKANAP ----- */
  if (nextWorkday) {
    res.write("<hr>");
    res.write(
      "<h2>Következő munkanap (" +
        nextWorkday.iso +
        " – " +
        capitalize(nextWorkday.napNev) +
        ")</h2>"
    );
    renderDay(res, dataByDate[nextWorkday.iso]);
  }

  /* ----- TOVÁBBI NAPOK ----- */
  res.write("<hr>");
  res.write("<details><summary><strong>A hét további napjai</strong></summary>");

  let showCount = 0;
  let futureOffset = offset + 1;

  // maximum 14 jövőbeli munkanapot vizsgálunk
  while (futureOffset < 30 && showCount < 10) {
    const d = getHuDate(futureOffset++);
    if (!isWorkday(d.napIndex)) continue;
    if (d.iso === today.iso || d.iso === nextWorkday.iso) continue;

    if (dataByDate[d.iso]) {
      res.write(
        "<h3>" + d.iso + " – " + capitalize(d.napNev) + "</h3>"
      );
      renderDay(res, dataByDate[d.iso]);
      showCount++;
    }
  }

  res.write("</details>");

  /* ----- QR KÓD + MEGJEGYZÉS ----- */
  const baseUrl = req.protocol + "://" + req.get("host");
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(baseUrl);

  res.write("<hr>");
  res.write("<h3>Honlap elérhetősége</h3>");
  res.write('<img src="' + qrUrl + '" alt="QR kód"><br>');
  res.write(
    "<p style='font-size:0.9em;color:#555;'>A szerver felébredése néhány másodpercet igénybe vehet.</p>"
  );
  res.write("<p>" + baseUrl + "</p>");

  res.write("</body></html>");
  res.end();
});

app.listen(port, () => {
  console.log("Menü szerver fut:", port);
});
