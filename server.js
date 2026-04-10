const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const menu = {
  hetfo: "H - Rántott hús, krumpli",
  kedd: "K - Gulyásleves, palacsinta",
  szerda: "SZE - Tészta carbonara",
  csutortok: "CS - Pörkölt nokedlivel",
  pentek: "P - Hal TEST, rizs",
  szombat: "SZO - Pizza",
  vasarnap: "V - Húsleves, sült hús"
};

app.get('/', (req, res) => {
  const napok = ["vasarnap","hetfo","kedd","szerda","csutortok","pentek","szombat"];
  const ma = napok[new Date().getDay()];
  const maiMenu = menu[ma] || "Nincs adat ma";

  res.send(`
    <!DOCTYPE html>
    <html lang="hu">
    <head>
      <meta charset="UTF-8">
      <title>Mai étlap</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #2c3e50; }
        #menu { font-size: 1.2em; color: #34495e; }
      </style>
    </head>
    <body>
      <h1>Mai menü</h1>
      <div id="menu">${maiMenu}</div>
    </body>
    </html>
  `);
});

app.listen(port, () => console.log(`Szerver fut: http://localhost:${port}`));
