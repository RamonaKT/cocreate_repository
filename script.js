import { supabase } from './supabase/client.js';

const params = new URLSearchParams(window.location.search);
const mindmapId = params.get('id');
let initialSyncDone = false;

const svg = document.getElementById('mindmap');


// Falls eine ID vorhanden ist, lade die Mindmap
if (mindmapId) {
  loadMindmapFromDB(mindmapId);
}

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const ydoc = new Y.Doc();
const provider = new WebsocketProvider('ws://localhost:1234', mindmapId, ydoc);

// Gemeinsame Datenstrukturen
const yNodes = ydoc.getMap('nodes');        // id => {x, y, type, label}
const yConnections = ydoc.getArray('connections'); // [{fromId, toId}]

yNodes.observe(event => {
  event.changes.keys.forEach((change, key) => {
    if (change.action === 'add' || change.action === 'update') {
      const { x, y, type, label } = yNodes.get(key);
      if (!allNodes.find(n => n.id === key)) {
        createDraggableNode(x, y, type, key, true);
      } else {
        const node = allNodes.find(n => n.id === key);
        node.x = x;
        node.y = y;
        node.group.setAttribute("transform", `translate(${x}, ${y})`);
        updateConnections(key);


        const text = node.group.querySelector('text');
        if (text && typeof label === "string" && text.textContent !== label) {
          text.textContent = label;
        }


      }
    } else if (change.action === 'delete') {
      const node = allNodes.find(n => n.id === key);
      if (node) {
        svg.removeChild(node.group);
        allNodes = allNodes.filter(n => n.id !== key);
        // Auch Verbindungen entfernen
        allConnections = allConnections.filter(conn => {
          if (conn.fromId === key || conn.toId === key) {
            svg.removeChild(conn.line);
            return false;
          }
          return true;
        });
      }
    }
  });
});


let priorConnections = yConnections.toArray(); // initialer Zustand merken

yConnections.observe(event => {
  const current = yConnections.toArray();

  console.log('YJS aktuelle Verbindungen:', yConnections.toArray());

  // 🔍 Was wurde NEU hinzugefügt?
  const added = current.filter(
    newConn => !priorConnections.some(
      oldConn => oldConn.fromId === newConn.fromId && oldConn.toId === newConn.toId
    )
  );

  // 🔍 Was wurde GELÖSCHT?
  const removed = priorConnections.filter(
    oldConn => !current.some(
      newConn => newConn.fromId === oldConn.fromId && newConn.toId === oldConn.toId
    )
  );

  added.forEach(({ fromId, toId }) => {
    console.log("➕ Neue Verbindung erkannt:", fromId, "→", toId);
    const exists = allConnections.some(c => c.fromId === fromId && c.toId === toId);
    if (!exists) {
      connectNodes(fromId, toId, true);
    }
  });

  removed.forEach(({ fromId, toId }) => {
    console.log("🧽 Entferne Verbindung (verglichen):", fromId, "→", toId);
    const conn = allConnections.find(c => c.fromId === fromId && c.toId === toId);
    if (conn) {
      svg.removeChild(conn.line);
      allConnections = allConnections.filter(c => c !== conn);
    }
  });

  priorConnections = current.map(c => ({ ...c }));
});


function deleteConnection(fromId, toId) {
  const current = yConnections.toArray();
  const updated = current.filter(conn => !(conn.fromId === fromId && conn.toId === toId));
  yConnections.delete(0, yConnections.length);
  yConnections.push(updated);
}


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

        /*  const index = yConnections.toArray().findIndex(conn => conn.fromId === fromId && conn.toId === toId);
          if (index !== -1) {
            // ✅ Direkt aus toArray holen (unverändert!)
            const deletedConnection = yConnections.toArray()[index];
            console.log('🗑️ Lösche Verbindung:', { fromId, toId });
            console.log(' Vorherige array:', yConnections.toArray());
            yConnections.delete(index, 1);
            console.log(' Nachher:', yConnections.toArray());
  
  
            // Jetzt kannst du sicher mit deletedConnection arbeiten
            const conn = allConnections.find(c => c.fromId === deletedConnection.fromId && c.toId === deletedConnection.toId);
            if (conn) {
              svg.removeChild(conn.line);
              allConnections = allConnections.filter(c => c !== conn);
            }
          }*/

        /*   for (let i = 0; i < yConnections.length; i++) {
             const conn = yConnections.get(i);
             if (conn.fromId === fromId && conn.toId === toId) {
               yConnections.delete(i, 1);
               break;
             }
               
           }*/

        deleteConnection(fromId, toId);
        if (selectedConnection === line) selectedConnection = null;
      });

      // Gibt es die Verbindung schon in yConnections?
     /* const alreadyExists = yConnections.toArray().some(conn =>
        conn.fromId === fromId && conn.toId === toId
      );*/

      if (!initialSyncDone) {
      const alreadyExists = yConnections.toArray().some(conn =>
        conn.fromId === fromId && conn.toId === toId
      );
      if (!alreadyExists) {
        yConnections.push([{ fromId, toId }]);
        console.log('⏳ Alte Verbindung in YJS eingetragen:', fromId, '→', toId);
      }
    }

      /* if (!alreadyExists) {
         yConnections.push([{ fromId, toId }]);
         console.log('⏳ Alte Verbindung in YJS eingetragen:', fromId, '→', toId);
       }*/
      allConnections.push({ fromId, toId, line });

    }
  });

}

import { getCreations, saveCreation } from './supabase/database.js';  // Pfad anpassen
/*
window.onload = async () => {
  try {
    const creations = await getCreations();
    console.log('Verbindung zu Supabase erfolgreich. Gefundene Daten:', creations);
  } catch (error) {
    console.error('Fehler bei der Verbindung zu Supabase:', error);
  }
};*/

window.onload = async () => {
  try {
    const creations = await getCreations();
    console.log('Verbindung zu Supabase erfolgreich. Gefundene Daten:', creations);
  } catch (error) {
    console.error('Fehler bei der Verbindung zu Supabase:', error);
  }

  const nickname = sessionStorage.getItem("mindmap_nickname");
  //const nickname = localStorage.getItem("mindmap_nickname");
  const params = new URLSearchParams(window.location.search);
  const mindmapId = params.get('id');

  if (mindmapId && !nickname) {
    createNicknameModal(); // oder: document.getElementById('nicknameModal').style.display = 'block';
  }
};



// saving mindmaps
function getSVGSource() {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}


async function saveCurrentMindmap() {
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
      const link = `${location.origin}/index.html?id=${id}`;
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

document.getElementById('saveButton').addEventListener('click', saveCurrentMindmap);


let draggedType = null;
let dragTarget = null;
let offset = { x: 0, y: 0 };

let allNodes = [];
let allConnections = [];
let selectedNode = null;
let selectedConnection = null; // neu

svg.style.touchAction = 'none';

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

svg.addEventListener('dragover', e => e.preventDefault());

svg.addEventListener('drop', e => {
  e.preventDefault();
  const svgPoint = getSVGPoint(e.clientX, e.clientY);
  createDraggableNode(svgPoint.x, svgPoint.y, draggedType);
});

// Browser-Koordinaten -> SVG-Koordinaten
function getSVGPoint(x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function createDraggableNode(x, y, type, idOverride, fromNetwork = false) {
  const style = nodeStyles[type];
  if (!style) return;

  //const id = 'node' + allNodes.length;
  const id = idOverride || 'node' + crypto.randomUUID();

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

  if (!fromNetwork) {
    yNodes.set(id, { x, y, type, label: "...", id });
  }

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

    const save = () => {
      const value = input.value.trim();
      if (value) {
        text.textContent = value;
        const current = yNodes.get(id);
        if (current) {
          yNodes.set(id, { ...current, label: value }); // <- label speichern!
        }
      }
      if (group.contains(fo)) {
        group.removeChild(fo);
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

function highlightNode(id, on) {
  const node = allNodes.find(n => n.id === id);
  if (!node) return;

  const shape = node.group.querySelector('ellipse, rect');
  if (!shape) return;

  if (on) shape.classList.add('highlighted');
  else shape.classList.remove('highlighted');
}

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

  yNodes.set(id, { ...yNodes.get(id), x: newX, y: newY });

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

    const fromId = line.dataset.from;
    const toId = line.dataset.to;

    deleteConnection(fromId, toId);



    if (selectedConnection === line) selectedConnection = null;
  });


  svg.insertBefore(line, svg.firstChild);
  allConnections.push({ fromId, toId, line });

  if (!fromNetwork) {
    yConnections.push([{ fromId, toId }]);
  }

}

// Delete-Taste zum Entfernen von Knoten oder Verbindung
document.addEventListener('keydown', (e) => {
  const activeElement = document.activeElement;
  if (activeElement && (
    activeElement.tagName === "INPUT" ||
    activeElement.tagName === "TEXTAREA" ||
    activeElement.isContentEditable
  )) {
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
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

// Pan mit WASD/Pfeiltasten (verschiebt ViewBox um festen Schritt)
const panStep = 20;
document.addEventListener("keydown", (e) => {
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
}


//start of ipaddress locking

let userNickname = null;
let userToLock = null;




function createNicknameModal() {
  if (document.getElementById('nicknameModal')) return; 

  const modal = document.createElement('div');
  modal.id = 'nicknameModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    background-color: rgba(0,0,0,0.5);
    z-index: 9999;
    display: none; align-items: center; justify-content: center;
  `;

  modal.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 10px; width: 300px; text-align: center;">
      <h2>Nickname wählen</h2>
      <input id="nicknameInput" type="text" placeholder="Dein Nickname" style="width: 100%; padding: 8px;" />
      <button id="nicknameSubmitButton" style="margin-top: 10px;">Speichern</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('nicknameSubmitButton').addEventListener('click', submitNickname);
}



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


function showNicknameModal() {
  let modal = document.getElementById('nicknameModal');

  if (!modal) {
    createNicknameModal();
    modal = document.getElementById('nicknameModal');
  }

  if (modal) {
    modal.style.display = 'flex';
  } else {
    console.error("Konnte Modal nicht anzeigen, da es nicht existiert.");
  }

  sessionStorage.removeItem("mindmap_nickname");
  localStorage.removeItem("mindmap_nickname");
}




function startIpLockWatcher(ip) {
  async function checkLock() {
    const mindmapId = new URLSearchParams(window.location.search).get('id');
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
              // Sperre ist abgelaufen → entsperren
              await supabase
                .from('users')
                .update({ locked: false, locked_until: null })
                .eq('nickname', user.nickname)
                .eq('mindmap_id', mindmapId);
              console.log(`Nutzer ${user.nickname} automatisch entsperrt.`);
            } else {
              // Noch gesperrt
              console.warn(`Nutzer ${user.nickname} ist noch gesperrt.`);
              showNicknameModal();
              return;
            }
          }
        }
      }
    } catch (err) {
      console.error("Fehler bei Lock-Überprüfung:", err);
    }

    setTimeout(checkLock, 5000);
  }

  checkLock();
}


async function loadUsersForCurrentMindmap() {
  const mindmapId = new URLSearchParams(window.location.search).get('id');
  const container = document.getElementById('userListContainer');
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
        document.getElementById('dialogIconOverviewUser').close();

        document.getElementById('ipLockOverlay').style.display = 'flex';
        document.getElementById('overlayMessage').textContent =
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

document.getElementById('confirmLockBtn').addEventListener('click', async () => {
  if (userToLock) {
    await lockUserByNickname(userToLock);

    // show confirmation in overlay
    const messageBox = document.getElementById('overlayMessage');
    messageBox.textContent = `locking IP from "${userToLock}" was successful.`;

    // don´t show buttons
    document.querySelector('.overlay-buttons').style.display = 'none';

    // close overlay after two seconds
    setTimeout(() => {
      document.getElementById('ipLockOverlay').style.display = 'none';
      document.querySelector('.overlay-buttons').style.display = 'flex';
      userToLock = null;
    }, 2000);
  }
});


document.getElementById('cancelLockBtn').addEventListener('click', () => {
  userToLock = null;
  document.getElementById('ipLockOverlay').style.display = 'none';
});


window.loadUsersForCurrentMindmap = loadUsersForCurrentMindmap;




