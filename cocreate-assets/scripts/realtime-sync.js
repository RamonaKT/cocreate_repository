import { io } from "https://cdn.socket.io/4.8.0/socket.io.esm.min.js";
import {state} from "./script-core";
import { mindmapId } from "./init";

//const svg = shadowRoot.getElementById('mindmap');;

let socket;
let allNodesRef = [];
let allConnectionsRef = [];
let svgRef;

export function initRealtimeSync(mindmapId, nodes, connections, svg) {
  const userId = `${Date.now()}-${Math.random()}`;
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000');
  socket.emit("join-map", { mindmapId, userId });

  allNodesRef = nodes;
  allConnectionsRef = connections;
  svgRef = svg;
  
    socket.emit("join-map", { mindmapId: mindmapId, userId });
    socket.on("initial-sync", ({ nodes, users }) => {
    nodes.forEach(data => {
        const node = state.allNodes.find(n => n.id === data.id);
        if (node) {
        node.x = data.x;
        node.y = data.y;
        node.group.setAttribute("transform", `translate(${data.x},${data.y})`);
        }
    });
    });

    socket.on("node-moving", data => {
    console.log("📡 node-moving empfangen", data);
    const node = state.allNodes.find(n => n.id === data.id);
    if (node) {
        node.x = data.x;
        node.y = data.y;
        node.group.setAttribute("transform", `translate(${data.x}, ${data.y})`);
        updateConnections(data.id);
    }
    });


    socket.on("node-moved", data => {
    const node = state.allNodes.find(n => n.id === data.id);
    if (node) {
        node.x = data.x;
        node.y = data.y;
        node.group.setAttribute("transform", `translate(${data.x},${data.y})`);
        updateConnections(data.id);
    }
    });

    socket.on("node-added", data => {
    if (!state.allNodes.find(n => n.id === data.id)) {
        createDraggableNode(data.x, data.y, data.type, data.id, true);
    }
    });
    socket.on("node-deleted", ({ id }) => {
    const nodeIndex = state.allNodes.findIndex(n => n.id === id);
    if (nodeIndex === -1) return;
    const node = state.allNodes[nodeIndex];
    if (svg.contains(node.group)) {
        svg.removeChild(node.group);
    }
    state.allNodes.splice(nodeIndex, 1);
    // Verbindungen entfernen
    state.allConnections = state.allConnections.filter(conn => {
        if (conn.fromId === id || conn.toId === id) {
        if (svg.contains(conn.line)) {
            svg.removeChild(conn.line);
        }
        return false;
        }
        return true;
    });
    });
    socket.on("connection-added", ({ fromId, toId }) => {
    // Duplikate verhindern
    if (state.allConnections.some(conn => conn.fromId === fromId && conn.toId === toId)) return;
    connectNodes(fromId, toId);
    });
    socket.on("connection-deleted", ({ fromId, toId }) => {
    const connIndex = state.allConnections.findIndex(conn => conn.fromId === fromId && conn.toId === toId);
    if (connIndex !== -1) {
        const conn = state.allConnections[connIndex];
        svg.removeChild(conn.line);
        state.allConnections.splice(connIndex, 1);
    }
    });
    socket.on("node-renamed", ({ id, text }) => {
    const node = state.allNodes.find(n => n.id === id);
    if (node) {
        const textEl = node.group.querySelector("text");
        if (textEl) {
        textEl.textContent = text;
        }
    }
    });

    socket.on("kicked", () => {
    alert("Du wurdest vom Admin entfernt.");
    window.location.href = "/";
    });
}


export { socket };
export let allNodes = [];
export let allConnections = [];
