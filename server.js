const express = require("express");constutl9JwMLHBWE/export?format=csv&amp;sheet=ADATOK";

/* ===== SEGÉD ===== */

const napNevek = ["vasárnap","hétfő","kedd","szerda","csütörtök","péntek","szombat"];
const honapRovid = ["jan.","febr.","márc.","ápr.","máj.","jún.","júl.","aug.","szept.","okt.","nov.","dec."];

const capitalize = s =&gt; s.charAt(0).toUpperCase() + s.slice(1);
const iso = d =&gt; d.toISOString().split("T")[0];
const fmt = d =&gt; `${honapRovid[d.getMonth()]} ${d.getDate()}`;

function todayHu() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" })
  );
}

function weekMonday(d) {
  const x = new Date(d);
  const diff = x.getDay() === 0 ? -6 : 1 - x.getDay();
  x.setDate(x.getDate() + diff);
  return x;
}

function renderDay(res, data) {
  for (const tipus in data) {
    res.write(`&lt;strong&gt;${tipus}&lt;/strong&gt;&lt;ul&gt;`);
    data[tipus].forEach(e =&gt; res.write(`&lt;li&gt;${e}&lt;/li&gt;`));
    res.write(`&lt;/ul&gt;`);
  }
}

/* ===== ADATBETÖLTÉS ===== */

async function loadData() {
  const csv = await (await fetch(CSV_URL)).text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

  const map = {};
  rows.forEach(r =&gt; {
    if (!r.etterem || !r.datum || !r.etel) return;
    map[r.etterem] ??= {};
    map[r.etterem][r.datum] ??= {};
    map[r.etterem][r.datum][r.tipus] ??= [];
    map[r.etterem][r.datum][r.tipus].push(r.etel);
  });

  return map;
}

/* ===== STÍLUS ===== */

const style = `
&lt;style&gt;
body {
  font-family: system-ui, sans-serif;
  margin: 1em;
}

ul {
  list-style: none;
  padding-left: 1.2em;
  margin: 0.3em 0 0.8em;
}

li::before {
  content: "– ";
}

img {
  max-width: 100%;
  height: auto;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin: 0.8em 0 0.4em;
}

.section-title::before,
.section-title::after {
  content: "";
  height: 1px;
  background: #999;
  flex: 1;
}

.section-title span {
  white-space: nowrap;
  font-weight: bold;
}
&lt;/style&gt;
`;

/* ===== FŐOLDAL ===== */

app.get("/", async (req, res) =&gt; {
  const db = await loadData();
  const etteremek = Object.keys(db).sort((a,b)=&gt;a.localeCompare(b,"hu"));
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.write(`&lt;!doctype html&gt;&lt;html lang="hu"&gt;&lt;head&gt;
&lt;meta charset="utf-8"&gt;
&lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;
${style}
&lt;/head&gt;&lt;body&gt;`);

  res.write(`&lt;h1&gt;Heti menük&lt;/h1&gt;&lt;ul&gt;`);
  etteremek.forEach(e =&gt; {
    res.write(`&lt;li&gt;&lt;a href="/etterem/${encodeURIComponent(e)}"&gt;▶ ${e}&lt;/a&gt;&lt;/li&gt;`);
  });
  res.write(`&lt;/ul&gt;`);

  res.write(`&lt;img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&amp;data=${encodeURIComponent(baseUrl)}"&gt;`);
  res.write(`&lt;p&gt;&lt;strong&gt;by István Gris&lt;/strong&gt;&lt;/p&gt;`);

  res.write(`&lt;/body&gt;&lt;/html&gt;`);
  res.end();
});

/* ===== ÉTTEREM OLDAL ===== */

app.get("/etterem/:etterem", async (req, res) =&gt; {
  const db = await loadData();
  const etterem = req.params.etterem;
  const data = db[etterem];
  if (!data) return res.status(404).send("Nincs ilyen étterem.");

  const today = todayHu();
  const monday = weekMonday(today);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const todayIso = iso(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = iso(tomorrow);

  const pageUrl = `${req.protocol}://${req.get("host")}/etterem/${encodeURIComponent(etterem)}`;

  res.write(`&lt;!doctype html&gt;&lt;html lang="hu"&gt;&lt;head&gt;
&lt;meta charset="utf-8"&gt;
&lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;
${style}
&lt;/head&gt;&lt;body&gt;`);

  res.write(`&lt;p&gt;&lt;a href="/"&gt;← Vissza az éttermekhez&lt;/a&gt;&lt;/p&gt;`);

  /* >>> DÁTUM ELTÁVOLÍTVA <<< */
  res.write(`&lt;h1&gt;Heti menü – ${etterem}&lt;/h1&gt;`);

  if (data[todayIso]) {
    res.write(`&lt;div class="section-title"&gt;&lt;span&gt;Mai nap – ${capitalize(napNevek[today.getDay()])} ${fmt(today)}&lt;/span&gt;&lt;/div&gt;`);
    renderDay(res, data[todayIso]);
  }

  if (data[tomorrowIso]) {
    res.write(`&lt;div class="section-title"&gt;&lt;span&gt;Következő nap – ${capitalize(napNevek[tomorrow.getDay()])} ${fmt(tomorrow)}&lt;/span&gt;&lt;/div&gt;`);
    renderDay(res, data[tomorrowIso]);
  }

  const future = [];
  for (let i = 0; i &lt; 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (data[iso(d)] &amp;&amp; d &gt; tomorrow) future.push(d);
  }

  if (future.length) {
    res.write(`&lt;details&gt;&lt;summary&gt;Aktuális hét további napjai&lt;/summary&gt;`);
    future.forEach(d =&gt; {
      res.write(`&lt;h3&gt;${capitalize(napNevek[d.getDay()])} ${fmt(d)}&lt;/h3&gt;`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`&lt;/details&gt;`);
  }

  const nextWeekMonday = new Date(monday);
  nextWeekMonday.setDate(monday.getDate() + 7);
  const next = [];

  for (let i = 0; i &lt; 5; i++) {
    const d = new Date(nextWeekMonday);
    d.setDate(nextWeekMonday.getDate() + i);
    if (data[iso(d)]) next.push(d);
  }

  if (next.length) {
    res.write(`&lt;details&gt;&lt;summary&gt;Következő hét&lt;/summary&gt;`);
    next.forEach(d =&gt; {
      res.write(`&lt;h3&gt;${capitalize(napNevek[d.getDay()])} ${fmt(d)}&lt;/h3&gt;`);
      renderDay(res, data[iso(d)]);
    });
    res.write(`&lt;/details&gt;`);
  }

  res.write(`&lt;img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&amp;data=${encodeURIComponent(pageUrl)}"&gt;`);
  res.write(`&lt;p&gt;&lt;strong&gt;by István Gris&lt;/strong&gt;&lt;/p&gt;`);

  res.write(`&lt;/body&gt;&lt;/html&gt;`);
  res.end();
});

app.listen(port, () =&gt;
  console.log("Menü szerver fut – dátum eltávolítva a heti menüből")
);
const fetch = require("node-fetch");
const { parse } = require("csv-parse/sync");

const app = express();
const port = process.env.PORT || 3000;

const CSV_URL =
