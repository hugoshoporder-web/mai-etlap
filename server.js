const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// ⬇️ PONTOSAN a sheet neve
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&sheet=ADATOK";

/* ===== SEGÉD ===== */

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getHuDate(offset = 0) {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
  d.setDate(d.getDate() + offset);

  const napNevek = [
    "vasárnap","hétfő","kedd","szerda",
    "csütörtök","péntek","szombat"
  ];

  return {
    iso: d.toISOString().split("T")[0], // YYYY-MM-DD
    napNev: napNevek[d.getDay()],
    napIndex: d.getDay()
  };
}

function isWorkday(idx) {
  return idx >= 1 && idx <= 5;
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

/* ===== ROUTE ===== */

app.get("/", async (req, res) => {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  /**
   * ADAT: dátum alapú!
   * datum -> etterem -> tipus -> ételek
   */
  const dataByDate = {};
  rows.forEach(r => {
    if (!r.datum || !r.etel) return;

    const datum = r.datum;
    const etterem = r.etterem || "Alap étterem";
    const tipus = r.tipus || "Egyéb";

    if (!dataByDate[datum]) dataByDate[datum] = {};
    if (!dataByDate[datum][etterem])
      dataByDate[datum][etterem] = {};
    if (!dataByDate[datum][etterem][tipus])
      dataByDate[datum][etterem][tipus] = [];

    dataByDate[datum][etterem][tipus].push(r.etel);
  });

  const today = getHuDate(0);

  /* ---- KÖVETKEZŐ MUNKANAP ---- */
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

  res.write("<!DOCTYPE html><html lang='hu'><head>");
  res.write("<meta charset='UTF-8'>");
  res.write("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  res.write("<title>Mai menü</title></head><body>");

  /* ===== MAI ===== */
  res.write(
    "<h1>Mai menü (" +
      today.iso +
      " – " +
      capitalize(today.napNev) +
      ")</h1>"
  );
  renderDay(res, dataByDate[today.iso]);

  /* ===== KÖVETKEZŐ MUNKANAP ===== */
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

  /* ===== TOVÁBBI NAPOK (CSA K DÁTUM ALAPON) ===== */
  res.write("<hr>");
  res.write("<details><summary><strong>A hét további napjai</strong></summary>");

  // 10 jövőbeli munkanapot mutatunk max.
  let shown = 0;
  let futureOffset = offset + 1;

  while (futureOffset < offset + 15 && shown < 10) {
    const d = getHuDate(futureOffset++);
    if (!isWorkday(d.napIndex)) continue;
    if (d.iso === today.iso) continue;
    if (nextWorkday && d.iso === nextWorkday.iso) continue;

    res.write(
      "<h3>" +
        d.iso +
        " – " +
        capitalize(d.napNev) +
        "</h3>"
    );
    renderDay(res, dataByDate[d.iso]);
    shown++;
  }

  res.write("</details>");

  /* ===== QR + MEGJEGYZÉS (VÁLTOZATLAN) ===== */
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
  console.log("Menü szerver fut – végleges, dátum‑alapú.");
});
``
