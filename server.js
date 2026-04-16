const express = require("express");
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

// Sheet neve PONTOSAN
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yPZUVn4PvNkGlyXdUedMkCWBa0J1f4Eutl9JwMLHBWE/export?format=csv&amp;sheet=ADATOK";

/* -------- SEGÉDFÜGGVÉNYEK -------- */

function normalizeNap(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getTodayHu() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );

  const napNevek = [
    "vasárnap",
    "hétfő",
    "kedd",
    "szerda",
    "csütörtök",
    "péntek",
    "szombat"
  ];
  const napKodok = [
    "vasarnap",
    "hetfo",
    "kedd",
    "szerda",
    "csutortok",
    "pentek",
    "szombat"
  ];

  return {
    datum: now.toISOString().split("T")[0],
    napNev: napNevek[now.getDay()],
    napKod: napKodok[now.getDay()]
  };
}

function getNextWorkdayHu() {
  let offset = 1;
  while (offset <= 7) {
    const d = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
    );
    d.setDate(d.getDate() + offset);

    const day = d.getDay();
    if (day >= 1 && day <= 5) {
      const napNevek = [
        "vasárnap", "hétfő", "kedd", "szerda",
        "csütörtök", "péntek", "szombat"
      ];
      const napKodok = [
        "vasarnap", "hetfo", "kedd", "szerda",
        "csutortok", "pentek", "szombat"
      ];

      return {
        datum: d.toISOString().split("T")[0],
        napNev: napNevek[day],
        napKod: napKodok[day]
      };
    }
    offset++;
  }
  return null;
}

function renderDay(res, dayData) {
  if (!dayData || Object.keys(dayData).length === 0) {
    res.write("&lt;p&gt;&lt;em&gt;Nincs adat.&lt;/em&gt;&lt;/p&gt;");
    return;
  }

  for (const etterem in dayData) {
    res.write("&lt;h3&gt;" + etterem + "&lt;/h3&gt;");
    for (const tipus in dayData[etterem]) {
      res.write("&lt;strong&gt;" + tipus + "&lt;/strong&gt;");
      res.write("&lt;ul&gt;");
      dayData[etterem][tipus].forEach(e =&gt;
        res.write("&lt;li&gt;" + e + "&lt;/li&gt;")
      );
      res.write("&lt;/ul&gt;");
    }
  }
}

/* -------- FŐ ROUTE -------- */

app.get("/", async (req, res) =&gt; {
  const response = await fetch(CSV_URL);
  const text = await response.text();

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const data = {};
  rows.forEach(r =&gt; {
    const nap = normalizeNap(r.nap);
    const etterem = r.etterem || "Alap étterem";
    const tipus = r.tipus || "Egyéb";
    const etel = r.etel;
    if (!etel) return;

    if (!data[nap]) data[nap] = {};
    if (!data[nap][etterem]) data[nap][etterem] = {};
    if (!data[nap][etterem][tipus])
      data[nap][etterem][tipus] = [];

    data[nap][etterem][tipus].push(etel);
  });

  const today = getTodayHu();

  res.write("&lt;!DOCTYPE html&gt;&lt;html lang='hu'&gt;&lt;head&gt;");
  res.write("&lt;meta charset='UTF-8'&gt;");
  res.write("&lt;meta name='viewport' content='width=device-width, initial-scale=1'&gt;");
  res.write("&lt;title&gt;Mai menü&lt;/title&gt;");
  res.write("&lt;/head&gt;&lt;body&gt;");

  res.write(
    "&lt;h1&gt;Mai menü (" + today.datum + " – " + capitalize(today.napNev) + ")&lt;/h1&gt;"
  );
  renderDay(res, data[today.napKod]);

  /* ---- KÖVETKEZŐ MUNKANAP ---- */
  const nextDay = getNextWorkdayHu();
  if (nextDay) {
    res.write("&lt;hr&gt;");
    res.write(
      "&lt;h2&gt;Következő munkanap (" +
        nextDay.datum +
        " – " +
        capitalize(nextDay.napNev) +
        ")&lt;/h2&gt;"
    );
    renderDay(res, data[nextDay.napKod]);
  }

  /* ---- QR + MEGJEGYZÉS ---- */
  const baseUrl = req.protocol + "://" + req.get("host");
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&amp;data=" +
    encodeURIComponent(baseUrl);

  res.write("&lt;hr&gt;");
  res.write("&lt;h3&gt;Honlap elérhetősége&lt;/h3&gt;");
  res.write('&lt;img src="' + qrUrl + '" alt="QR kód"&gt;&lt;br&gt;');
  res.write(
    "&lt;p style='font-size:0.9em;color:#555;'&gt;A szerver felébredése néhány másodpercet igénybe vehet.&lt;/p&gt;"
  );
  res.write("&lt;p&gt;" + baseUrl + "&lt;/p&gt;");

  res.write("&lt;/body&gt;&lt;/html&gt;");
  res.end();
});

app.listen(port, () =&gt; {
  console.log("Menü szerver fut – stabil verzió + következő munkanap");
});
