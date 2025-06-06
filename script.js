const svg = document.getElementById('mindmap');
let draggedType = null;
let dragTarget = null;
let offset = { x: 0, y: 0 };

let allNodes = [];
let allConnections = [];
let selectedNode = null;

const getCSSColor = (level) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-level-${level}`).trim();

const nodeStyles = {
  1: { r: 50, color: getCSSColor(1), label: 'Ebene 1' },
  2: { r: 40, color: getCSSColor(2), label: 'Ebene 2' },
  3: { r: 30, color: getCSSColor(3), label: 'Ebene 3' }
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

// Browser-Koordinaten -> SVG
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

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", 0);
  circle.setAttribute("cy", 0);
  circle.setAttribute("r", style.r);
  circle.setAttribute("fill", style.color);
  group.appendChild(circle);

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", 0);
  text.setAttribute("y", 0);
  text.setAttribute("fill", "white");
  text.setAttribute("font-size", "12");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("alignment-baseline", "middle");
  text.textContent = style.label;
  group.appendChild(text);

  allNodes.push({ id, group, x, y, r: style.r });

  // Drag-Handler
  group.addEventListener('mousedown', e => {
    if (e.shiftKey) return;
    dragTarget = group;
    const point = getSVGPoint(e.clientX, e.clientY);
    const transform = group.getCTM();
    offset.x = point.x - transform.e;
    offset.y = point.y - transform.f;

    circle.classList.add('dragging');
  });

  svg.addEventListener('mouseup', () => {
    if (dragTarget) {
      const circle = dragTarget.querySelector('circle');
      circle.classList.remove('dragging');
    }
    dragTarget = null;
  });

  // Verbindung-Handler
  group.addEventListener('click', e => {
    e.stopPropagation();
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

  // ✍️ Doppelklick zum Umbenennen (SVG-intern, transparent)
  text.addEventListener('dblclick', e => {
    e.stopPropagation();

    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.setAttribute("x", -40);
    fo.setAttribute("y", -10);
    fo.setAttribute("width", 80);
    fo.setAttribute("height", 20);

    const input = document.createElement("input");
    input.setAttribute("type", "text");
    input.setAttribute("value", text.textContent);

    fo.appendChild(input);
    group.appendChild(fo);
    input.focus();

    const save = () => {
      text.textContent = input.value;
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
  const circle = node.group.querySelector('circle');
  if (on) circle.classList.add('highlighted');
  else circle.classList.remove('highlighted');
}

// Rest deines JS-Codes (dragging, connectNodes, updateConnections etc.)

// Drag-Bewegung
svg.addEventListener('mousemove', e => {
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

// Drag-Ende
svg.addEventListener('mouseup', () => {
  dragTarget = null;
});

// Deselect auf SVG-Klick
svg.addEventListener('click', () => {
  if (selectedNode !== null) {
    highlightNode(selectedNode, false);
    selectedNode = null;
  }
});

// Verbindung aktualisieren bei Bewegung
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
  line.setAttribute("stroke-width", "2");
  line.setAttribute("class", "connection-line");

  // Event zum Löschen der Linie per Rechtsklick
  line.addEventListener("contextmenu", e => {
    e.preventDefault();
    // Linie entfernen
    svg.removeChild(line);
    // Aus Verbindungsarray löschen
    allConnections = allConnections.filter(conn => conn.line !== line);
  });

  svg.insertBefore(line, svg.firstChild); // unter die Knoten legen
  allConnections.push({ fromId, toId, line });
}
