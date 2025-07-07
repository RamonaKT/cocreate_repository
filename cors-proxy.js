import express from 'express';
import fetch from 'node-fetch';

const app = express();
const REMOTE_URL = 'http://141.72.13.151:8200/component.js';

app.get('/component.js', async (req, res) => {
  try {
    const remoteRes = await fetch(REMOTE_URL);
    const body = await remoteRes.text();

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(body);
  } catch (err) {
    console.error('Fehler beim Weiterleiten:', err);
    res.status(500).send('Proxy-Fehler');
  }
});

const PORT = 8081;
app.listen(PORT, () => {
  console.log(`🚀 CORS-Proxy läuft auf http://localhost:${PORT}/component.js`);
});
