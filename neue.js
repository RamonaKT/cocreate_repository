
import { supabase } from '../../supabase/client.js';
// ----------- NEU ANFANG -------------- //
import { io } from "https://cdn.socket.io/4.8.0/socket.io.esm.min.js";
// ----------- NEU ENDE -------------- //
import { getCreations, saveCreation } from '../../supabase/database.js';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
const params = new URLSearchParams(window.location.search);
const mindmapId = params.get('id');
let initialSyncDone = false;
//const svg = document.getElementById('mindmap');
let dragLine = null;
let svg = null;
// ----------- NEU ANFANG -------------- //
let saveTimeout;
function scheduleSVGSave(delay = 1000) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveSVGToSupabase();
  }, delay);
}
async function saveSVGToSupabase() {
  if (!mindmapId) {
    return;
  }
  console.log("adding to supabase");
  const svgData = getSVGSource();
  const { data, error } = await supabase
    .from('creations')
    .update({ svg_code: svgData })
    .eq('creationid', mindmapId);
  if (error) {
    console.error('Fehler beim Speichern des SVGs:', error.message);
    // Optional: Fehler weiter werfen oder anderweitig behandeln
    throw new Error('Speichern des SVGs in Supabase fehlgeschlagen: ' + error.message);
  }
  console.log("added to supabase :)))")
  return data; // Optional: Rückgabe der aktualisierten Daten
}
// ----------- NEU ENDE -------------- //

function updateConnections(movedId) {
  allConnections.forEach(conn => {
    if (conn.fromId === movedId || conn.toId === movedId) {
      const from = allNodes.find(n => n.id === conn.fromId);
      const to = allNodes.find(n => n.id === conn.toId);
      conn.line.setAttribute("x1", from.x);
      conn.line.setAttribute("y1", from.y);
      conn.line.setAttribute("x2", to.x);
      conn.line.setAttribute("y2", to.y);
    }
  });
}
function connectNodes(fromId, toId, fromNetwork = false) {
  const from = allNodes.find(n => n.id === fromId);
  const to = allNodes.find(n => n.id === toId);
  if (!from || !to) return;
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", from.x);
  line.setAttribute("y1", from.y);
  line.setAttribute("x2", to.x);
  line.setAttribute("y2", to.y);
  line.dataset.from = fromId;
  line.dataset.to = toId;
  line.setAttribute("stroke", "#888");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("class", "connection-line");
  svg.appendChild(line);
  line.addEventListener("click", e => {
    e.stopPropagation();
    if (selectedNode !== null) {
      highlightNode(selectedNode, false);
      selectedNode = null;
    }
    if (selectedConnection) {
      selectedConnection.classList.remove("highlighted");
    }
    selectedConnection = line;
    selectedConnection.classList.add("highlighted");
  });
  line.addEventListener("contextmenu", e => {
    e.preventDefault();
    // ----------- NEU ANFANG -------------- //
    svg.removeChild(line);
    allConnections = allConnections.filter(conn => conn.line !== line);
    if (selectedConnection === line) selectedConnection = null;
    if (socket) {
      socket.emit("connection-deleted", {
        fromId: line.dataset.from,
        toId: line.dataset.to
      });
      scheduleSVGSave();
    }
  });
  // ----------- NEU ENDE -------------- //
  svg.insertBefore(line, svg.firstChild);
  allConnections.push({ fromId, toId, line });
  // ----------- NEU ANFANG -------------- //
  if (socket) {
    socket.emit("connection-added", { fromId, toId });
    scheduleSVGSave();
  }
  // ----------- NEU ENDE -------------- //
}


function highlightNode(id, on) {
  const node = allNodes.find(n => n.id === id);
  if (!node) return;
  const shape = node.group.querySelector('ellipse, rect');
  if (!shape) return;
  if (on) shape.classList.add('highlighted');
  else shape.classList.remove('highlighted');
}
function createNicknameModal(shadowroot = document) {
  if (document.getElementById('nicknameModal')) return;
  const modal = document.createElement('div');
  modal.id = 'nicknameModal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Nickname wählen</h2>
      <input id="nicknameInput" type="text" placeholder="Dein Nickname" />
      <button id="nicknameSubmitButton">Speichern</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('nicknameSubmitButton').addEventListener('click', submitNickname);
  document.getElementById('nicknameInput').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitNickname();
    }
  });
}
function addEventListenersToNode(group, id, r) {
  const node = allNodes.find(n => n.id === id);
  if (!node) return;
  const shape = group.querySelector('ellipse, rect');
  const text = group.querySelector('text');
  // Drag Start
  group.addEventListener('pointerdown', e => {
    const isInputClick = e.target.tagName === 'INPUT' || e.target.closest('foreignObject');
    if (isInputClick) return;
    if (e.shiftKey) return;
    const point = getSVGPoint(e.clientX, e.clientY);
    dragTarget = group;
    offset.x = point.x - node.x;
    offset.y = point.y - node.y;
    shape.classList.add('dragging');
  });
  // Drag-Ende auf SVG (mouseup)
  svg.addEventListener('pointerup', (e) => {
    if (dragTarget) {
      const id = dragTarget.dataset.nodeId;
      const node = allNodes.find(n => n.id === id);
      if (!node) return;
      const shape = node.group.querySelector('ellipse, rect');
      if (!shape) return;
      shape.classList.remove('dragging');
      if (socket) {
        socket.emit("node-moved", { id: node.id, x: node.x, y: node.y });
        scheduleSVGSave();
      }
    }
    dragTarget = null;
  });
  svg.addEventListener('pointercancel', e => {
    if (dragTarget) {
      const id = dragTarget.dataset.nodeId;
      const node = allNodes.find(n => n.id === id);
      if (!node) return;
      const shape = node.group.querySelector('ellipse, rect');
      if (!shape) return;
      shape.classList.remove('dragging');
    }
    dragTarget = null;
  });
  // Click-Verbindung
  group.addEventListener('click', e => {
    e.stopPropagation();
    if (selectedConnection) {
      selectedConnection.classList.remove('highlighted');
      selectedConnection = null;
    }
    if (selectedNode === null) {
      selectedNode = id;
      highlightNode(id, true);
    } else if (selectedNode !== id) {
      connectNodes(selectedNode, id);
      highlightNode(selectedNode, false);
      selectedNode = null;
    } else {
      highlightNode(selectedNode, false);
      selectedNode = null;
    }
  });
  // Doppelklick zum Umbenennen
  text?.addEventListener('dblclick', e => {
    e.stopPropagation();
    if (group.querySelector('foreignObject')) return;
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.setAttribute("x", -r);
    fo.setAttribute("y", -10);
    fo.setAttribute("width", r * 2);
    fo.setAttribute("height", 20);
    const input = document.createElement("input");
    input.setAttribute("type", "text");
    input.setAttribute("value", text.textContent);
    fo.appendChild(input);
    fo.style.pointerEvents = 'all';
    group.appendChild(fo);
    input.focus();
    const save = async () => {
      const value = input.value.trim();
      if (value) {
        text.textContent = value;
      }
      if (group.contains(fo)) {
        group.removeChild(fo);
      }
      if (socket) {
        socket.emit("node-renamed", { id, text: value });
        try {
          await saveSVGToSupabase(); // <- hier wird gewartet
        } catch (e) {
          console.error("Fehler beim Speichern:", e);
        }
      }
    };
    input.addEventListener("blur", save);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        group.removeChild(fo);
      }
    });
  });
}
function createDraggableNode(x, y, type, idOverride, fromNetwork = false) {
  const style = nodeStyles[type];
  if (!style) return;
  //const id = 'node' + allNodes.length;
  const id = idOverride || 'node' + createUUID();
  console.log('randomUUID exists?', !!window.crypto?.randomUUID);

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "draggable");
  group.setAttribute("transform", `translate(${x}, ${y})`);
  group.dataset.nodeId = id;
  svg.appendChild(group);
  let shape;
  if (type === "1") {
    // Oval (Ellipse)
    shape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    shape.setAttribute("cx", 0);
    shape.setAttribute("cy", 0);
    shape.setAttribute("rx", style.r);
    shape.setAttribute("ry", style.r * 0.6);
  } else if (type === "2") {
    // Rechteck mit abgerundeten Ecken
    shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shape.setAttribute("x", -style.r);
    shape.setAttribute("y", -style.r * 0.6);
    shape.setAttribute("width", style.r * 2);
    shape.setAttribute("height", style.r * 1.2);
    shape.setAttribute("rx", 15);
    shape.setAttribute("ry", 15);
  } else {
    // Rechteck mit scharfen Ecken (Ebene 3)
    shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shape.setAttribute("x", -style.r);
    shape.setAttribute("y", -style.r * 0.6);
    shape.setAttribute("width", style.r * 2);
    shape.setAttribute("height", style.r * 1.2);
    shape.setAttribute("rx", 0);
    shape.setAttribute("ry", 0);
  }
  shape.setAttribute("fill", style.color);
  group.appendChild(shape);
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", 0);
  text.setAttribute("y", 0);
  text.setAttribute("fill", "black");
  text.setAttribute("font-size", style.fontSize);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("alignment-baseline", "middle");
  text.textContent = "...";
  group.appendChild(text);

  allNodes.push({ id, group, x, y, r: style.r });
  addEventListenersToNode(group, id, style.r);
  // ----------- NEU ANFANG -------------- //
  if (socket) {
    if (!fromNetwork) {
      socket.emit("node-added", { id, x, y, type });
    }
    scheduleSVGSave();
    // ----------- NEU ENDE -------------- //
  }
}
async function initializeAccessControl(shadowRoot) {
  const mindmapId = new URLSearchParams(window.location.search).get('id');
  if (!mindmapId) return;
  createNicknameModal(); // Modal vorbereiten
  let ip = 'unknown';
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    ip = data.ip;
  } catch (err) {
    console.warn("IP konnte nicht ermittelt werden:", err);
    showNicknameModal();
    return;
  }
  startIpLockWatcher(ip, mindmapId, shadowRoot);
  const storedNickname = localStorage.getItem("mindmap_nickname");
  if (storedNickname) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('nickname', storedNickname)
        .eq('ipadress', ip)
        .maybeSingle();
      if (!error && user && !user.locked && user.mindmap_id === mindmapId) {
        userNickname = storedNickname;
        console.log("Automatisch eingeloggt:", userNickname);
        shadowRoot.getElementById('nicknameModal')?.remove();
        return;
      }
    } catch (e) {
      console.error("Fehler bei Login mit gespeicherten Nickname:", e);
    }
  }
  // Fallback: Suche Benutzer mit passender IP und Mindmap
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('ipadress', ip)
      .eq('mindmap_id', mindmapId)
      .maybeSingle();
    if (!error && user && !user.locked) {
      userNickname = user.nickname;
      localStorage.setItem("mindmap_nickname", userNickname);
      console.log("Automatisch über IP eingeloggt:", userNickname);
      shadowRoot.getElementById('nicknameModal')?.remove();
      return;
    }
  } catch (err) {
    console.error("Fehler bei Login über IP:", err);
  }
  loadUsersForCurrentMindmap(shadowRoot);
  showNicknameModal();
}
function showNicknameModal(shadowRoot = document) {
  let modal = shadowRoot.getElementById('nicknameModal');
  if (!modal) {
    createNicknameModal();
    modal = shadowRoot.getElementById('nicknameModal');
  }
  if (modal) {
    modal.style.display = 'flex';
  } else {
    console.error("⚠️ Konnte Modal nicht anzeigen – fehlt.");
  }
  sessionStorage.removeItem("mindmap_nickname");
  localStorage.removeItem("mindmap_nickname");
}
function startIpLockWatcher(ip, mindmapId, shadowRoot) {
  async function checkLock() {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('nickname, locked, locked_until')
        .eq('ipadress', ip)
        .eq('mindmap_id', mindmapId);
      if (error) {
        console.error("Fehler bei Lock-Check:", error.message);
      } else {
        const now = new Date();
        for (const user of users) {
          if (user.locked) {
            const until = user.locked_until ? new Date(user.locked_until) : null;
            if (until && now >= until) {
              await supabase
                .from('users')
                .update({ locked: false, locked_until: null })
                .eq('nickname', user.nickname)
                .eq('mindmap_id', mindmapId);
              console.log(`🔓 Nutzer ${user.nickname} automatisch entsperrt.`);
            } else {
              console.warn(`🚫 Nutzer ${user.nickname} ist noch gesperrt.`);
              showNicknameModal();
              return;
            }
          }
        }
      }
    } catch (err) {
      console.error("Fehler bei Lock-Überprüfung:", err);
    }
    setTimeout(checkLock, 5000); // regelmäßig prüfen
  }
  checkLock();
}
// ----------- NEU ANFANG -------------- //
// SOCKET IO:
let socket = null;
if (mindmapId) {
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000');
  const userId = `${Date.now()}-${Math.random()}`;
  socket.emit("join-map", { mapId: mindmapId, userId });
  socket.on("initial-sync", ({ nodes, users }) => {
    nodes.forEach(data => {
      const node = allNodes.find(n => n.id === data.id);
      if (node) {
        node.x = data.x;
        node.y = data.y;
        node.group.setAttribute("transform", `translate(${data.x},${data.y})`);
      }
    });
  });
  socket.on("node-moving", data => {
    console.log("📡 node-moving empfangen", data);
    const node = allNodes.find(n => n.id === data.id);
    if (node) {
      node.x = data.x;
      node.y = data.y;
      node.group.setAttribute("transform", `translate(${data.x}, ${data.y})`);
      updateConnections(data.id);
    }
  });

  socket.on("node-moved", data => {
    const node = allNodes.find(n => n.id === data.id);
    if (node) {
      node.x = data.x;
      node.y = data.y;
      node.group.setAttribute("transform", `translate(${data.x},${data.y})`);
      updateConnections(data.id);
    }
  });
  socket.on("node-added", data => {
    if (!allNodes.find(n => n.id === data.id)) {
      createDraggableNode(data.x, data.y, data.type, data.id, true);
    }
  });
  socket.on("node-deleted", ({ id }) => {
    const nodeIndex = allNodes.findIndex(n => n.id === id);
    if (nodeIndex === -1) return;
    const node = allNodes[nodeIndex];
    if (svg.contains(node.group)) {
      svg.removeChild(node.group);
    }
    allNodes.splice(nodeIndex, 1);
    // Verbindungen entfernen
    allConnections = allConnections.filter(conn => {
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
    if (allConnections.some(conn => conn.fromId === fromId && conn.toId === toId)) return;
    connectNodes(fromId, toId);
  });
  socket.on("connection-deleted", ({ fromId, toId }) => {
    const connIndex = allConnections.findIndex(conn => conn.fromId === fromId && conn.toId === toId);
    if (connIndex !== -1) {
      const conn = allConnections[connIndex];
      svg.removeChild(conn.line);
      allConnections.splice(connIndex, 1);
    }
  });
  socket.on("node-renamed", ({ id, text }) => {
    const node = allNodes.find(n => n.id === id);
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
  socket.on("user-joined", ({ userId, isAdmin }) => {
    // aktualisiere UI
  });
  socket.on("user-kicked", ({ userId }) => {
    // entferne aus UI
  });
  socket.on("user-left", ({ userId }) => {
    // entferne aus UI
  });
}
// ----------- NEU ENDE -------------- //
function createUUID() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback: einfache, sichere UUID-Alternative
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


// saving mindmaps
function getSVGSource() {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}
export async function saveCurrentMindmap() {
  const title = prompt("Titel eingeben:");
  if (!title) return;
  const svgData = getSVGSource();
  const ip = await fetch('https://api.ipify.org').then(res => res.text());
  try {
    const result = await saveCreation(svgData, title, ip);
    // Nehme die ID der gespeicherten Zeile aus Supabase
    const id = result[0]?.creationid;
    if (id) {
      alert("Erfolgreich gespeichert! Du wirst weitergeleitet...");
      const link = `${location.origin}/?id=${id}`;
      window.location.href = link;
      console.log(link);
    } else {
      alert("Gespeichert, aber keine ID zurückbekommen.");
    }
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    alert("Fehler beim Speichern!");
  }
}
let draggedType = null;
let dragTarget = null;
let offset = { x: 0, y: 0 };
let allNodes = [];
let allConnections = [];
let selectedNode = null;
let selectedConnection = null; // neu
const getCSSColor = (level) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-level-${level}`).trim();
const nodeStyles = {
  1: { r: 60, color: getCSSColor(1), label: 'Ebene 1', fontSize: 16 },
  2: { r: 50, color: getCSSColor(2), label: 'Ebene 2', fontSize: 14 },
  3: { r: 40, color: getCSSColor(3), label: 'Ebene 3', fontSize: 12 },
};
// Drag aus Toolbar
document.querySelectorAll('.node-template').forEach(el => {
  el.addEventListener('dragstart', e => {
    draggedType = e.target.getAttribute('data-type');
  });
});
// Browser-Koordinaten -> SVG-Koordinaten
function getSVGPoint(x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
// --- ZOOM und PAN mit ViewBox ---
const initialViewBoxSize = 500;
const centerX = 250;
const centerY = 250;
let viewBox = {
  x: centerX - initialViewBoxSize / 2,
  y: centerY - initialViewBoxSize / 2,
  w: initialViewBoxSize,
  h: initialViewBoxSize,
};
// Pan mit WASD/Pfeiltasten (verschiebt ViewBox um festen Schritt)
const panStep = 20;
/*
async function exportMindmapToPDF() {
  const { jsPDF } = window.jspdf;
  const svgElement = document.getElementById('mindmap');
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [svgElement.clientWidth, svgElement.clientHeight],
  });
  // svg2pdf erwartet ein Promise (oder callback)
  await window.svg2pdf(svgElement, pdf, {
    xOffset: 0,
    yOffset: 0,
    scale: 1
  });
  pdf.save("mindmap.pdf");
} */
export async function exportMindmapToPDF() {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [svg.clientWidth, svg.clientHeight],
  });
  await svg2pdf(svg, pdf, {
    xOffset: 0,
    yOffset: 0,
    scale: 1
  });
  pdf.save("mindmap.pdf");
}
window.exportMindmapToPDF = exportMindmapToPDF;
//start of ipaddress locking
let userNickname = null;
let userToLock = null;

window.submitNickname = async function () {
  const input = document.getElementById('nicknameInput').value.trim();
  if (!input) {
    alert("Bitte Nickname eingeben.");
    return;
  }
  const mindmapId = new URLSearchParams(window.location.search).get('id');
  if (!mindmapId) {
    alert("Keine gültige Mindmap-ID in der URL.");
    return;
  }
  let ip = 'unknown';
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    ip = data.ip;
  } catch (err) {
    console.warn("IP konnte nicht ermittelt werden:", err);
  }
  const { data: existingLocks, error: lockError } = await supabase
    .from('users')
    .select('locked, locked_until')
    .eq('ipadress', ip)
    .eq('mindmap_id', mindmapId);
  if (lockError) {
    alert("Fehler beim Sperr-Check.");
    return;
  }
  const now = new Date();
  const anyLocked = existingLocks?.some(user =>
    user.locked && (!user.locked_until || new Date(user.locked_until) > now)
  );
  if (anyLocked) {
    alert("Du bist für diese Mindmap aktuell gesperrt.");
    return;
  }
  try {
    // versuch dass pro Mindmap nur jeder nickname einmal, aber sonst häufiger
    const { data: existingUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('nickname', input)
      .eq('mindmap_id', mindmapId)
      .maybeSingle();
    if (error) {
      alert("Fehler beim Überprüfen des Nicknames.");
      return;
    }
    if (existingUser) {
      if (existingUser.locked) {
        alert("Dieser Nickname ist aktuell gesperrt.");
        return;
      }
      alert("Dieser Nickname ist für diese Mindmap bereits vergeben.");
      return;
    }
    // Hol dir admin_ip für diese Mindmap
    const { data: creationData, error: creationError } = await supabase
      .from('creations')
      .select('admin_ip')
      .eq('creationid', mindmapId)
      .single();
    if (creationError || !creationData) {
      alert("Mindmap-Info konnte nicht geladen werden.");
      return;
    }
    const isAdmin = creationData.admin_ip === ip;
    // versuch dass pro Mindmap nur jeder nickname einmal, aber sonst häufiger
    const { error: insertError } = await supabase
      .from('users')
      .insert([{
        nickname: input,
        ipadress: ip,
        locked: false,
        admin: isAdmin,
        mindmap_id: parseInt(mindmapId)
      }]);
    if (isAdmin) console.log("Adminrechte zugewiesen");
    if (insertError) {
      alert("Fehler beim Speichern: " + insertError.message);
      return;
    }
    // Nutzer erfolgreich gespeichert
    userNickname = input;
    localStorage.setItem("mindmap_nickname", userNickname);
    document.getElementById('nicknameModal')?.remove();
    startIpLockWatcher(ip);
    console.log("Neuer Nutzer gespeichert & Zugriff erlaubt:", userNickname);
  } catch (err) {
    console.error("Fehler bei Nickname-Speicherung:", err);
    alert("Fehler beim Speichern.");
  }
};
window.addEventListener('load', async () => {
  const mindmapId = new URLSearchParams(window.location.search).get('id');
  if (!mindmapId) return;
  // Modal vorbereiten, aber noch nicht zeigen
  createNicknameModal();
  let ip = 'unknown';
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    ip = data.ip;
  } catch (err) {
    console.warn("IP konnte nicht ermittelt werden:", err);
    showNicknameModal();
    return;
  }
  // Sofort Sperre prüfen
  startIpLockWatcher(ip);
  // Zuerst: nickname aus localStorage versuchen
  const storedNickname = localStorage.getItem("mindmap_nickname");
  if (storedNickname) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('nickname', storedNickname)
        .eq('ipadress', ip)
        .maybeSingle();
      if (!error && user && !user.locked && user.mindmap_id == mindmapId) {
        userNickname = storedNickname;
        console.log("Automatisch eingeloggt:", userNickname);
        document.getElementById('nicknameModal')?.remove();
        startIpLockWatcher(ip);
        return;
      }
    } catch (e) {
      console.error("Fehler bei Login mit gespeicherten Nickname:", e);
    }
  }
  // Wenn nicht: per IP nach gültigem Nutzer suchen
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('ipadress', ip)
      .eq('mindmap_id', mindmapId)
      .maybeSingle();
    if (!error && user && !user.locked) {
      userNickname = user.nickname;
      localStorage.setItem("mindmap_nickname", userNickname);
      console.log("Automatisch über IP eingeloggt:", userNickname);
      document.getElementById('nicknameModal')?.remove();
      startIpLockWatcher(ip);
      return;
    }
  } catch (err) {
    console.error("Fehler bei Login über IP:", err);
  }
  showNicknameModal();
});
async function loadUsersForCurrentMindmap(shadowRoot = document) {
  const mindmapId = new URLSearchParams(window.location.search).get('id');
  const container = shadowRoot.getElementById('userListContainer');
  container.innerHTML = ''; // vorher leeren
  if (!mindmapId) {
    container.textContent = "Keine gültige Mindmap-ID.";
    return;
  }
  const { data: users, error } = await supabase
    .from('users')
    .select('nickname, locked, admin, ipadress')
    .eq('mindmap_id', mindmapId);
  if (error) {
    container.textContent = "Fehler beim Laden der Nutzer.";
    console.error("Fehler beim Laden der User:", error.message);
    return;
  }
  if (!users || users.length === 0) {
    container.textContent = "Keine Nutzer gefunden.";
    return;
  }
  const currentUser = users.find(u => u.nickname === userNickname);
  const isAdmin = currentUser?.admin;
  users.forEach(user => {
    const div = document.createElement('div');
    div.className = 'user-entry';
    if (user.locked) div.classList.add('locked');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = user.nickname;
    div.appendChild(nameSpan);
    if (user.admin) {
      const badge = document.createElement('span');
      badge.className = 'badge admin';
      badge.textContent = 'Admin';
      div.appendChild(badge);
    }
    if (isAdmin && user.nickname !== userNickname) {
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        userToLock = user.nickname;
        shadowRoot.getElementById('dialogIconOverviewUser').close();
        shadowRoot.getElementById('ipLockOverlay').style.display = 'flex';
        shadowRoot.getElementById('overlayMessage').textContent =
          `Do you want to lock IP from "${user.nickname}" ?`;
      });
    }
    container.appendChild(div);
  });
}
async function lockUserByNickname(nickname) {
  const lockUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 Minuten
  const { error } = await supabase
    .from('users')
    .update({ locked: true, locked_until: lockUntil })
    .eq('nickname', nickname);
  if (error) {
    alert("Fehler beim Sperren: " + error.message);
    return;
  }
  console.log(`User "${nickname}" wurde bis ${lockUntil} gesperrt.`);
}
window.loadUsersForCurrentMindmap = loadUsersForCurrentMindmap;


async function loadMindmapFromDB(id) {
  const { data, error } = await supabase
    .from('creations')
    .select('svg_code, title, admin_ip')
    .eq('creationid', id)
    .single();
  if (error || !data) {
    alert("Mindmap nicht gefunden.");
    return;
  }
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(data.svg_code, "image/svg+xml");
  const loadedSVG = svgDoc.documentElement;
  svg.innerHTML = loadedSVG.innerHTML; // Inhalte übernehmen
  svg.setAttribute("viewBox", loadedSVG.getAttribute("viewBox") || "0 0 1000 600");
  // Initialisiere geladene Knoten
  svg.querySelectorAll('g.draggable').forEach(group => {
    const id = group.dataset.nodeId || 'node' + allNodes.length;
    const transform = group.getAttribute("transform");
    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
    const x = parseFloat(match?.[1] || 0);
    const y = parseFloat(match?.[2] || 0);
    const shape = group.querySelector('ellipse, rect');
    const r = shape?.getAttribute('rx') || shape?.getAttribute('r') || 40;


    allNodes.push({ id, group, x, y, r: parseFloat(r) });
    // EventListener hinzufügen wie in createDraggableNode()
    addEventListenersToNode(group, id, parseFloat(r));
  });



  svg.querySelectorAll('line.connection-line').forEach(line => {
    const fromId = line.dataset.from;
    const toId = line.dataset.to;
    if (fromId && toId) {
      // Event-Handling hinzufügen
      line.addEventListener("click", e => {
        e.stopPropagation();
        if (selectedNode !== null) {
          highlightNode(selectedNode, false);
          selectedNode = null;
        }
        if (selectedConnection) {
          selectedConnection.classList.remove("highlighted");
        }
        selectedConnection = line;
        selectedConnection.classList.add("highlighted");
      });
      line.addEventListener("contextmenu", e => {
        e.preventDefault();
        if (svg.contains(line)) {
          svg.removeChild(line);
        }
        // ----------- NEU ANFANG -------------- //
        if (socket) {
          socket.emit("connection-deleted", {
            fromId: line.dataset.from,
            toId: line.dataset.to
          });
          scheduleSVGSave();
        }
        // ----------- NEU ENDE -------------- //
        allConnections = allConnections.filter(conn => conn.line !== line);
        if (selectedConnection === line) selectedConnection = null;
      })
      allConnections.push({ fromId, toId, line });
      // ----------- NEU ANFANG -------------- //
      if (socket) {
        socket.emit("connection-added", { fromId, toId });
        scheduleSVGSave();
      }
      // ----------- NEU ENDE -------------- //
    }
  });
}
export function setupMindmap(shadowRoot) {
  shadowRoot.host.tabIndex = 0; // macht den Host "fokusierbar"
  shadowRoot.host.focus();      // setzt direkt den Fokus
  svg = shadowRoot.getElementById('mindmap');
  if (!svg) {
    console.error("SVG nicht im Shadow DOM gefunden!");
    return;
  }
  svg.style.touchAction = 'none';
  const saveBtn = shadowRoot.getElementById('saveButton');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveCurrentMindmap);
  }
  shadowRoot.querySelectorAll('.node-template').forEach(el => {
    el.addEventListener('dragstart', e => {
      draggedType = e.target.getAttribute('data-type');
    });
  });
  svg.addEventListener('dragover', e => e.preventDefault());
  svg.addEventListener('drop', e => {
    e.preventDefault();
    const svgPoint = getSVGPoint(e.clientX, e.clientY);
    createDraggableNode(svgPoint.x, svgPoint.y, draggedType);
  });
  svg.addEventListener('pointermove', e => {
    if (dragLine) {
      const svgPoint = getSVGPoint(e.clientX, e.clientY);
      dragLine.setAttribute("x2", svgPoint.x);
      dragLine.setAttribute("y2", svgPoint.y);
    }
  });
  dragLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  svg.appendChild(dragLine);
  if (dragLine) {
    svg.removeChild(dragLine);
    dragLine = null;
  }
  svg.addEventListener('click', () => {
    if (selectedNode) {
      highlightNode(selectedNode, false);
      selectedNode = null;
    }
    if (selectedConnection) {
      selectedConnection.classList.remove('highlighted');
      selectedConnection = null;
    }
  });
  const confirmBtn = shadowRoot.getElementById('confirmLockBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (userToLock) {
        await lockUserByNickname(userToLock);
        const messageBox = shadowRoot.getElementById('overlayMessage');
        messageBox.textContent = `locking IP from "${userToLock}" was successful.`;
        shadowRoot.querySelector('.overlay-buttons').style.display = 'none';
        setTimeout(() => {
          shadowRoot.getElementById('ipLockOverlay').style.display = 'none';
          shadowRoot.querySelector('.overlay-buttons').style.display = 'flex';
          userToLock = null;
        }, 2000);
      }
    });
  }
  const cancelBtn = shadowRoot.getElementById('cancelLockBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      shadowRoot.getElementById('ipLockOverlay').style.display = 'none';
      userToLock = null;
    });
  }
  shadowRoot.host.addEventListener("keydown", (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    switch (e.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        viewBox.y -= panStep * (viewBox.h / initialViewBoxSize);
        updateViewBox();
        break;
      case 's':
      case 'arrowdown':
        viewBox.y += panStep * (viewBox.h / initialViewBoxSize);
        updateViewBox();
        break;
      case 'a':
      case 'arrowleft':
        viewBox.x -= panStep * (viewBox.w / initialViewBoxSize);
        updateViewBox();
        break;
      case 'd':
      case 'arrowright':
        viewBox.x += panStep * (viewBox.w / initialViewBoxSize);
        updateViewBox();
        break;
    }
  });

  // Drag-Bewegung
  svg.addEventListener('pointermove', e => {
    if (!dragTarget) return;
    const point = getSVGPoint(e.clientX, e.clientY);
    const id = dragTarget.dataset.nodeId;
    const node = allNodes.find(n => n.id === id);
    if (!node) return;
    const newX = point.x - offset.x;
    const newY = point.y - offset.y;
    dragTarget.setAttribute("transform", `translate(${newX}, ${newY})`);
    node.x = newX;
    node.y = newY;
    // ----------- NEU ANFANG -------------- //
    if (socket) {
      socket.emit("node-moving", {
        id: node.id,
        x: node.x,
        y: node.y,
      });
    }
    // ----------- NEU ENDE -------------- //
    console.log(" node-moving gesendet", node.id, node.x, node.y);
    updateConnections(id);
  });

  // Deselect auf SVG-Klick
  svg.addEventListener('click', () => {
    if (selectedNode !== null) {
      highlightNode(selectedNode, false);
      selectedNode = null;
    }
    if (selectedConnection) {
      selectedConnection.classList.remove('highlighted');
      selectedConnection = null;
    }
  });
  // Delete-Taste zum Entfernen von Knoten oder Verbindung
  document.addEventListener('keydown', (e) => {
    const activeElement = document.activeElement;
    const isInputFocused = (
      activeElement &&
      (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.isContentEditable ||
        activeElement.closest("foreignObject") // ← Wichtig für deine SVG-Inputs!
      )
    );
    if (isInputFocused) {
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (selectedConnection) {
        const fromId = selectedConnection.dataset.from;
        const toId = selectedConnection.dataset.to;
        if (svg.contains(selectedConnection)) {
          svg.removeChild(selectedConnection);
        }
        allConnections = allConnections.filter(conn =>
          conn.line !== selectedConnection
        );
        selectedConnection = null;
        // ----------- NEU ANFANG -------------- //
        if (socket) {
          socket.emit("connection-deleted", {
            fromId,
            toId
          });
          scheduleSVGSave();
        }
        // ----------- NEU ENDE -------------- //
        return;
      }

      if (selectedNode) {
        const nodeIndex = allNodes.findIndex(n => n.id === selectedNode);
        if (nodeIndex === -1) return;
        const node = allNodes[nodeIndex];
        svg.removeChild(node.group);
        allNodes.splice(nodeIndex, 1);
        // ----------- NEU ANFANG -------------- //
        if (socket) {
          socket.emit("node-deleted", { id: selectedNode });
          scheduleSVGSave();
        }
        // ----------- NEU ENDE -------------- //
        // Verbindungen mit dem Knoten entfernen
        allConnections = allConnections.filter(conn => {
          if (conn.fromId === selectedNode || conn.toId === selectedNode) {
            svg.removeChild(conn.line);
            return false;
          }
          return true;
        });
        selectedNode = null;
      }
    }
  });
  svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  let zoom = 1;
  const zoomStep = 0.025;
  const minZoom = 0.1;
  const maxZoom = 3;
  // Zoom mit Mausrad
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    // Zoomrichtung
    zoom += e.deltaY > 0 ? -zoomStep : zoomStep;
    zoom = Math.min(Math.max(zoom, minZoom), maxZoom);
    // Zoom um Mausposition (optional)
    const mouseSVG = getSVGPoint(e.clientX, e.clientY);
    // Neue ViewBox-Größe basierend auf Zoom
    const newWidth = initialViewBoxSize / zoom;
    const newHeight = initialViewBoxSize / zoom;
    // ViewBox so verschieben, dass Zoom um Mausposition bleibt
    viewBox.x = mouseSVG.x - (mouseSVG.x - viewBox.x) * (newWidth / viewBox.w);
    viewBox.y = mouseSVG.y - (mouseSVG.y - viewBox.y) * (newHeight / viewBox.h);
    viewBox.w = newWidth;
    viewBox.h = newHeight;
    updateViewBox();
  });
  function updateViewBox() {
    svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  }
  const downloadBtn = shadowRoot.getElementById('downloadbtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const svgElement = shadowRoot.getElementById('mindmap');
      if (svgElement) {
        exportMindmapAsSVG(svgElement);
      } else {
        console.error("SVG nicht gefunden für Export.");
      }
    });
  }

  initializeAccessControl(shadowRoot);
  // Falls eine ID vorhanden ist, lade die Mindmap
  if (mindmapId) {
    loadMindmapFromDB(mindmapId);
  }
  console.log("✅ Mindmap im Shadow DOM vollständig initialisiert");
}
window.addEventListener('load', async () => {
  const mindmapId = new URLSearchParams(window.location.search).get('id');
  if (!mindmapId) return;
  // Modal vorbereiten (erstellen)
  createNicknameModal();
  let ip = 'unknown';
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    ip = data.ip;
  } catch (err) {
    console.warn("IP konnte nicht ermittelt werden:", err);
    showNicknameModal();
    return;
  }
  // Nickname aus localStorage?
  const storedNickname = localStorage.getItem("mindmap_nickname");
  if (storedNickname) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('nickname', storedNickname)
        .eq('ipadress', ip)
        .maybeSingle();
      if (!error && user && !user.locked && user.mindmap_id == mindmapId) {
        userNickname = storedNickname;
        console.log("Automatisch eingeloggt:", userNickname);
        document.getElementById('nicknameModal')?.remove();
        startIpLockWatcher(ip);
        return;
      }
    } catch (e) {
      console.error("Fehler bei Login mit gespeicherten Nickname:", e);
    }
  }
  // Versuch per IP
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('ipadress', ip)
      .eq('mindmap_id', mindmapId)
      .maybeSingle();
    if (!error && user && !user.locked) {
      userNickname = user.nickname;
      localStorage.setItem("mindmap_nickname", userNickname);
      console.log("Automatisch über IP eingeloggt:", userNickname);
      document.getElementById('nicknameModal')?.remove();
      startIpLockWatcher(ip);
      return;
    }
  } catch (err) {
    console.error("Fehler bei Login über IP:", err);
  }
  // Fallback → Nickname abfragen
  showNicknameModal();
});
function exportMindmapAsSVG(svgElement) {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mindmap.svg";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
