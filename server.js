// server.js (als ES-Modul)
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';


import { dirname } from 'path';

const _dirname = dirname(_filename);

const app = express();
app.use(cors());



import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GANZ AM ANFANG – VOR ALLEN Routen oder static()
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});



// Setze CORS-Header für ALLE statischen Dateien
/*app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // oder deine Domain
  next();
});*/
/*
app.use('/components', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static(path.join(__dirname, 'cocreate-assets/scripts')));
*/
app.get('/script-core.js', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, 'cocreate-assets/scripts/script-core.js'));
});




// Nur für component.js den CORS-Header setzen
/*app.get('/component.js', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, 'cocreate-assets/scripts/component.js'));
});*/

app.get('/component.js', (req, res) => {
  console.log('>> /component.js geladen');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // <<< wichtig!
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendFile(path.join(__dirname, 'cocreate-assets/scripts/component.js'));
});





const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // In Produktion: hier deine echte URL eintragen
    }
});

// Datenstruktur: mapId -> { nodes, users, connections }
const maps = new Map();

io.on('connection', (socket) => {
    console.log('🟢 Neue Verbindung:', socket.id);

    socket.on('join-map', ({ mapId, userId }) => {
        socket.join(mapId);
        socket.data.mapId = mapId;
        socket.data.userId = userId;

        if (!maps.has(mapId)) {
            maps.set(mapId, {
                nodes: [],
                connections: [],
                users: {},
            });
        }

        const map = maps.get(mapId);
        map.users[userId] = socket.id;

        socket.emit('initial-sync', {
            nodes: map.nodes,
            users: Object.keys(map.users),
        });

        socket.to(mapId).emit('user-joined', { userId, isAdmin: false });
    });

    socket.on('node-added', (data) => {
        const map = maps.get(socket.data.mapId);
        map.nodes.push(data);
        socket.to(socket.data.mapId).emit('node-added', data);
    });

    socket.on('node-moving', (data) => {
        socket.to(socket.data.mapId).emit('node-moving', data);
    });

    socket.on('node-moved', (data) => {
        const map = maps.get(socket.data.mapId);
        const node = map.nodes.find((n) => n.id === data.id);
        if (node) {
            node.x = data.x;
            node.y = data.y;
        }
        socket.to(socket.data.mapId).emit('node-moved', data);
    });

    socket.on('node-deleted', ({ id }) => {
        const map = maps.get(socket.data.mapId);
        map.nodes = map.nodes.filter((n) => n.id !== id);
        map.connections = map.connections.filter((c) => c.fromId !== id && c.toId !== id);
        socket.to(socket.data.mapId).emit('node-deleted', { id });
    });

    socket.on('node-renamed', ({ id, text }) => {
        socket.to(socket.data.mapId).emit('node-renamed', { id, text });
    });

    socket.on('connection-added', ({ fromId, toId }) => {
        const map = maps.get(socket.data.mapId);
        map.connections.push({ fromId, toId });
        socket.to(socket.data.mapId).emit('connection-added', { fromId, toId });
    });

    socket.on('connection-deleted', ({ fromId, toId }) => {
        const map = maps.get(socket.data.mapId);
        map.connections = map.connections.filter(
            (c) => !(c.fromId === fromId && c.toId === toId)
        );
        socket.to(socket.data.mapId).emit('connection-deleted', { fromId, toId });
    });

    socket.on('disconnect', () => {
        const mapId = socket.data.mapId;
        const userId = socket.data.userId;
        if (mapId && userId && maps.has(mapId)) {
            const map = maps.get(mapId);
            delete map.users[userId];
            socket.to(mapId).emit('user-left', { userId });
            console.log(`🔴 ${userId} hat ${mapId} verlassen`);
        }
    });
});

//const PORT = process.env.PORT || 3000;
/*server.listen(PORT, () => {
    console.log(`🚀 Socket.IO Server läuft auf http://localhost:${PORT}`);
});*/
/*
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Socket.IO Server läuft auf http://0.0.0.0:${PORT}`);
});*/

const PORT = 8200;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server läuft auf http://0.0.0.0:${PORT}`);
});

