import { getCreations } from './supabase/database.js';  // Pfad anpassen

window.onload = async () => {
  try {
    const creations = await getCreations();
    console.log('Verbindung zu Supabase erfolgreich. Gefundene Daten:', creations);
  } catch (error) {
    console.error('Fehler bei der Verbindung zu Supabase:', error);
  }
};


// saving mindmaps
function getSVGSource() {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

import { saveCreation } from './supabase/database.js';

async function saveCurrentMindmap() {
  const title = prompt("Titel eingeben:");
  const svgData = getSVGSource();
  const ip = await fetch('/api/ip').then(res => res.text()); // Oder anders

  try {
    await saveCreation(svgData, title, ip);
    alert("Gespeichert!");
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
  }
}

document.getElementById('saveButton').addEventListener('click', saveCurrentMindmap);
//

const svg = document.getElementById('mindmap');
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

function createDraggableNode(x, y, type) {
  const style = nodeStyles[type];
  if (!style) return;

  const id = 'node' + allNodes.length;

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

  // Drag-Start
  group.addEventListener('pointerdown', e => {

    const isInputClick = e.target.tagName === 'INPUT' || e.target.closest('foreignObject');
    if (isInputClick) return;

    if (e.shiftKey) return;

    const point = getSVGPoint(e.clientX, e.clientY);
    const id = group.dataset.nodeId;
    const node = allNodes.find(n => n.id === id);
    if (!node) return;

    dragTarget = group;
    offset.x = point.x - node.x;
    offset.y = point.y - node.y;

    const shape = node.group.querySelector('ellipse, rect');
    if (!shape) return;

    shape.classList.add('dragging');

    /*group.setPointerCapture(e.pointerId);*/
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
      /*  dragTarget.releasePointerCapture(e.pointerId);*/
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
      /*  dragTarget.releasePointerCapture(e.pointerId);*/
    }
    dragTarget = null;
  });


  // Klick-Handler für Verbindungen
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
  text.addEventListener('dblclick', e => {
    e.stopPropagation();

    if (group.querySelector('foreignObject')) return;

    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.setAttribute("x", -style.r);
    fo.setAttribute("y", -10);
    fo.setAttribute("width", style.r * 2);
    fo.setAttribute("height", 20);

    const input = document.createElement("input");
    input.setAttribute("type", "text");
    input.setAttribute("value", text.textContent);
    input.setAttribute("placeholder", "Bezeichnung eingeben");

    fo.appendChild(input);
    fo.style.pointerEvents = 'all';
    group.appendChild(fo);

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    const save = () => {
      const value = input.value.trim();
      if (value) {
        text.textContent = value;
      }
      group.removeChild(fo);
    };

    input.addEventListener("blur", save);

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") save();
      else if (e.key === "Escape") group.removeChild(fo);
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

function connectNodes(fromId, toId) {
  const from = allNodes.find(n => n.id === fromId);
  const to = allNodes.find(n => n.id === toId);
  if (!from || !to) return;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", from.x);
  line.setAttribute("y1", from.y);
  line.setAttribute("x2", to.x);
  line.setAttribute("y2", to.y);
  line.setAttribute("stroke", "#888");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("class", "connection-line");

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
    svg.removeChild(line);
    allConnections = allConnections.filter(conn => conn.line !== line);
    if (selectedConnection === line) selectedConnection = null;
  });

  svg.insertBefore(line, svg.firstChild); // unter Knoten
  allConnections.push({ fromId, toId, line });
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
      svg.removeChild(selectedConnection);
      allConnections = allConnections.filter(conn => conn.line !== selectedConnection);
      selectedConnection = null;
      return;
    }

    if (selectedNode) {
      const nodeIndex = allNodes.findIndex(n => n.id === selectedNode);
      if (nodeIndex === -1) return;

      const node = allNodes[nodeIndex];
      svg.removeChild(node.group);
      allNodes.splice(nodeIndex, 1);

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
