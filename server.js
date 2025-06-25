// server.js
import http from "http";
import { Server } from "socket.io";

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*" },
});

const mindmaps = {}; // { [mapId]: { users: [{userId,socketId,isAdmin}], nodes: [] } }

io.on("connection", socket => {
  socket.on("join-map", ({ mapId, userId }) => {
    socket.join(mapId);
    socket.data = { mapId, userId };

    if (!mindmaps[mapId]) {
      mindmaps[mapId] = { users: [], nodes: [] };
    }

    const map = mindmaps[mapId];
    const isAdmin = map.users.length === 0;
    map.users.push({ userId, socketId: socket.id, isAdmin });
    if (isAdmin) console.log(`📌 ${userId} is admin of ${mapId}`);

    socket.emit("initial-sync", { nodes: map.nodes, users: map.users });

    io.to(mapId).emit("user-joined", { userId, isAdmin });
  });


 socket.on("node-moving", data => {
  const { mapId } = socket.data;
  if (!mapId) return;
  socket.to(mapId).emit("node-moving", data);
});



  socket.on("node-moved", data => {
    const { mapId } = socket.data;
    const map = mindmaps[mapId];
    if (!map) return;

    const idx = map.nodes.findIndex(n => n.id === data.id);
    if (idx >= 0) map.nodes[idx] = data;
    else map.nodes.push(data);

    socket.to(mapId).emit("node-moved", data);
  });

  socket.on("node-added", data => {
    const { mapId } = socket.data;
    const map = mindmaps[mapId];
    if (!map) return;

    map.nodes.push(data);
    socket.to(mapId).emit("node-added", data);
  });

  socket.on("kick-user", targetUserId => {
    const { mapId, userId } = socket.data;
    const map = mindmaps[mapId];
    if (!map) return;

    const requester = map.users.find(u => u.userId === userId);
    if (!requester?.isAdmin) return;

    const victim = map.users.find(u => u.userId === targetUserId);
    if (!victim) return;

    io.to(victim.socketId).emit("kicked");
    io.sockets.sockets.get(victim.socketId)?.disconnect();

    map.users = map.users.filter(u => u.userId !== targetUserId);
    io.to(mapId).emit("user-kicked", { userId: targetUserId });
  });

  socket.on("disconnect", () => {
    const { mapId, userId } = socket.data || {};
    const map = mindmaps[mapId];
    if (map) {
      map.users = map.users.filter(u => u.userId !== userId);
      io.to(mapId).emit("user-left", { userId });
    }
  });
});


io.on("connection", (socket) => {
  socket.on("node-deleted", ({ id }) => {
    socket.broadcast.emit("node-deleted", { id });
  });

  socket.on("connection-added", ({ fromId, toId }) => {
    socket.broadcast.emit("connection-added", { fromId, toId });
  });

  socket.on("connection-deleted", ({ fromId, toId }) => {
    socket.broadcast.emit("connection-deleted", { fromId, toId });
  });

  socket.on("node-renamed", ({ id, text }) => {
    socket.broadcast.emit("node-renamed", { id, text });
  });

  // die vorhandenen wie "node-moving" etc. bleiben erhalten
});


server.listen(3000, () => console.log("Socket.IO server listening on :3000"));
