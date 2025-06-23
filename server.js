const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Statische Dateien (HTML, CSS, JS, Bilder) aus diesem Ordner bereitstellen:
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join('Aindex.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});
