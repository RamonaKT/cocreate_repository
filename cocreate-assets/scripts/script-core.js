import { supabase } from '../../supabase/client.js';
import { getCreations, saveCreation } from '../../supabase/database.js';  // Pfad anpassen
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { initYjs, observeYjs, yNodes, yConnections } from './realtime-sync.js';
import {
  enableToolbarDrag,
  enableSvgDrop
} from './dragdrop.js';

import {
  updateViewBox,
  enableKeyboardPan,
  enableScrollZoom
} from './viewbox.js';

import {
  createNicknameModal,
  showNicknameModal,
  submitNickname,
  initializeAccessControl,
  startIpLockWatcher,
  loadUsersForCurrentMindmap,
  lockUserByNickname
} from './nicknames.js';
import {
  getSVGSource,
  exportMindmapAsSVG,
  exportMindmapToPDF,
  saveCurrentMindmap
} from './storage.js';

import {
  allNodes,
  allConnections,
  selectedNode,
  selectedConnection,
  createDraggableNode,
  addEventListenersToNode,
  updateConnections,
  connectNodes,
  deleteConnection,
  highlightNode
} from './nodes.js';


const params = new URLSearchParams(window.location.search);
const mindmapId = params.get('id');
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:1234';
const initialViewBoxSize = 500;
const centerX = 250;
const centerY = 250;
const panStep = 20; // Pan mit WASD/Pfeiltasten (verschiebt ViewBox um festen Schritt)

const getCSSColor = (level) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-level-${level}`).trim();
  const nodeStyles = {
  1: { r: 60, color: getCSSColor(1), label: 'Ebene 1', fontSize: 16 },
  2: { r: 50, color: getCSSColor(2), label: 'Ebene 2', fontSize: 14 },
  3: { r: 40, color: getCSSColor(3), label: 'Ebene 3', fontSize: 12 },
};

let initialSyncDone = false;
let dragLine = null; 
let svg = null;
let draggedType = null;
let dragTarget = null;
let offset = { x: 0, y: 0 };
let userNickname = null;
let userToLock = null;
let viewBox = {
  x: centerX - initialViewBoxSize / 2,
  y: centerY - initialViewBoxSize / 2,
  w: initialViewBoxSize,
  h: initialViewBoxSize,
};


window.submitNickname = submitNickname;
window.exportMindmapToPDF = exportMindmapToPDF;
window.loadUsersForCurrentMindmap = loadUsersForCurrentMindmap;


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

// Drag aus Toolbar
document.querySelectorAll('.node-template').forEach(el => {
  el.addEventListener('dragstart', e => {
    draggedType = e.target.getAttribute('data-type');
  });
});


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

      const text = group.querySelector('text');
      if (text) {
        const node = allNodes.find(n => n.id === id);
        const yNodeData = yNodes.get(id);
        if (yNodeData?.label) {
          text.textContent = yNodeData.label;
        }
      }

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

          const fromId = line.dataset.from;
          const toId = line.dataset.to;
    
          deleteConnection(fromId, toId);
          if (selectedConnection === line) selectedConnection = null;
        });

        if (!initialSyncDone) {
        const alreadyExists = yConnections.toArray().some(conn =>
          conn.fromId === fromId && conn.toId === toId
        );
        if (!alreadyExists) {
          yConnections.push([{ fromId, toId }]);
          console.log('⏳ Alte Verbindung in YJS eingetragen:', fromId, '→', toId);
        }
      }

        allConnections.push({ fromId, toId, line });

      }
    });

}

export function setupMindmap(shadowRoot) {
  // Fokus setzen
  shadowRoot.host.tabIndex = 0;
  shadowRoot.host.focus();

  const svg = shadowRoot.getElementById("mindmap");
  if (!svg) {
    console.error("SVG nicht im Shadow DOM gefunden!");
    return;
  }

  // Initialisierung der Viewbox-Steuerung
  enableKeyboardPan(svg);
  enableScrollZoom(svg);
  updateViewBox(svg);

  // Initialisierung der Realtime-Synchronisation (Yjs)
  initYjs(mindmapId);
  observeYjs(allNodes, allConnections, svg);

  // Drag & Drop Setup
  enableToolbarDrag(shadowRoot);
  enableSvgDrop(svg, (shape, x, y) => {
    const id = generateId();
    yNodes.set(id, { id, x, y, text: "Neuer Knoten", shape });
  });

  // Zoombegrenzung (nur wenn gebraucht)
  let zoom = 1;
  const minZoom = 0.1;
  const maxZoom = 3;

  // DragLine vorbereiten
  let dragLine = null;
  svg.addEventListener("pointermove", e => {
    if (dragLine) {
      const svgPoint = getSVGPoint(svg, e.clientX, e.clientY);
      dragLine.setAttribute("x2", svgPoint.x);
      dragLine.setAttribute("y2", svgPoint.y);
    }
  });

  // Drag von Knoten
  svg.addEventListener("pointermove", e => {
    if (!dragTarget) return;
    const point = getSVGPoint(svg, e.clientX, e.clientY);
    const id = dragTarget.dataset.nodeId;
    const node = allNodes.find(n => n.id === id);
    if (!node) return;

    const newX = point.x - offset.x;
    const newY = point.y - offset.y;
    dragTarget.setAttribute("transform", `translate(${newX}, ${newY})`);
    node.x = newX;
    node.y = newY;

    yNodes.set(id, { ...yNodes.get(id), x: newX, y: newY });
    updateConnections(id);
  });

  // Click zum Deselektieren
  svg.addEventListener("click", () => {
    if (selectedNode !== null) {
      highlightNode(selectedNode, false);
      selectedNode = null;
    }
    if (selectedConnection) {
      selectedConnection.classList.remove('highlighted');
      selectedConnection = null;
    }
  });

  // Löschen mit Delete-Taste
  document.addEventListener("keydown", (e) => {
    const isTextInput = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (isTextInput) return;

    if (["Delete", "Backspace"].includes(e.key)) {
      e.preventDefault();

      if (selectedConnection) {
        const fromId = selectedConnection.dataset.from;
        const toId = selectedConnection.dataset.to;
        deleteConnection(fromId, toId);
        selectedConnection = null;
        return;
      }

      if (selectedNode) {
        const nodeIndex = allNodes.findIndex(n => n.id === selectedNode);
        if (nodeIndex === -1) return;
        const node = allNodes[nodeIndex];

        svg.removeChild(node.group);
        allNodes.splice(nodeIndex, 1);
        yNodes.delete(selectedNode);

        // Zugehörige Verbindungen löschen
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

  // Export/Save Buttons
  const downloadBtn = shadowRoot.getElementById('downloadbtn');
  downloadBtn?.addEventListener('click', () => exportMindmapAsSVG(svg));

  const saveBtn = shadowRoot.getElementById('saveButton');
  saveBtn?.addEventListener('click', () => saveCurrentMindmap(svg));

  // Lock-Overlay-Buttons
  shadowRoot.getElementById('confirmLockBtn')?.addEventListener('click', async () => {
    if (userToLock) {
      await lockUserByNickname(userToLock);
      const msg = shadowRoot.getElementById('overlayMessage');
      msg.textContent = `locking IP from "${userToLock}" was successful.`;
      shadowRoot.querySelector('.overlay-buttons').style.display = 'none';

      setTimeout(() => {
        shadowRoot.getElementById('ipLockOverlay').style.display = 'none';
        shadowRoot.querySelector('.overlay-buttons').style.display = 'flex';
        userToLock = null;
      }, 2000);
    }
  });

  shadowRoot.getElementById('cancelLockBtn')?.addEventListener('click', () => {
    shadowRoot.getElementById('ipLockOverlay').style.display = 'none';
    userToLock = null;
  });

  // Zugriffskontrolle und Daten laden
  initializeAccessControl(shadowRoot);
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
