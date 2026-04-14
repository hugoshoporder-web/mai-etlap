const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("OK - a szerver fut");
});

app.listen(port, () => {
  console.log("Server fut a porton:", port);
});
