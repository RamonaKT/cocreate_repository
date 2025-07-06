import { supabase } from '../../supabase/client.js';
import { socket, initRealtimeSync } from './realtime-sync.js';
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
  exportMindmapAsSVG,
  exportMindmapToPDF,
  saveCurrentMindmap,
  scheduleSVGSave
} from './storage.js';
import {
  allNodes,
  allConnections,
  selectedNode,
  selectedConnection,
  addEventListenersToNode,
  updateConnections,
  highlightNode
} from './nodes.js';

const params = new URLSearchParams(window.location.search);
const mindmapId = params.get('id');
const getCSSColor = (level) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-level-${level}`).trim();
  const nodeStyles = {
  1: { r: 60, color: getCSSColor(1), label: 'Ebene 1', fontSize: 16 },
  2: { r: 50, color: getCSSColor(2), label: 'Ebene 2', fontSize: 14 },
  3: { r: 40, color: getCSSColor(3), label: 'Ebene 3', fontSize: 12 },
};

let svg = null;
let dragTarget = null;
let offset = { x: 0, y: 0 };
let userNickname = null;
let userToLock = null;
let dragLine = null;
let viewBox = { x: 0, y: 0, w: 3000, h: 2000 };

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
        socket.emit("connection-deleted", {
          fromId: line.dataset.from,
          toId: line.dataset.to
        });
        scheduleSVGSave();
        allConnections = allConnections.filter(conn => conn.line !== line);
        if (selectedConnection === line) selectedConnection = null;
      })
      allConnections.push({ fromId, toId, line });
      socket.emit("connection-added", { fromId, toId });
      scheduleSVGSave();
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
    socket.emit("node-moving", {
      id: node.id,
      x: node.x,
      y: node.y,
    });
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
        socket.emit("connection-deleted", {
          fromId,
          toId
        });
        scheduleSVGSave();
        return;
      }
      if (selectedNode) {
        const nodeIndex = allNodes.findIndex(n => n.id === selectedNode);
        if (nodeIndex === -1) return;
        const node = allNodes[nodeIndex];
        svg.removeChild(node.group);
        allNodes.splice(nodeIndex, 1);
        socket.emit("node-deleted", { id: selectedNode });
        scheduleSVGSave();
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
  initRealtimeSync(mindmapId, allNodes, allConnections, svg);
  socket.on("user-joined", ({ userId, isAdmin }) => {
  // aktualisiere UI
  });
  socket.on("user-kicked", ({ userId }) => {
    // entferne aus UI
  });
  socket.on("user-left", ({ userId }) => {
    // entferne aus UI
  });
  console.log("✅ Mindmap im Shadow DOM vollständig initialisiert");
}
