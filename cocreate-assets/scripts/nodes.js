
import { socket } from './realtime-sync.js';
import {
  getSVGSource,
  exportMindmapAsSVG,
  exportMindmapToPDF,
  saveCurrentMindmap,
  scheduleSVGSave,
  saveSVGToSupabase
} from './storage.js';

import { state, nodeStyles, createUUID } from './script-core.js';
const svg = shadowRoot.getElementById('mindmap');


export function updateConnections(movedId) {
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

export function connectNodes(fromId, toId, fromNetwork = false) {
  const from = state.allNodes.find(n => n.id === fromId);
  const to = state.allNodes.find(n => n.id === toId);
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
    if (state.selectedNode !== null) {
      highlightNode(state.selectedNode, false);
      state.selectedNode = null;
    }
    if (state.selectedConnection) {
      state.selectedConnection.classList.remove("highlighted");
    }
    state.selectedConnection = line;
    state.selectedConnection.classList.add("highlighted");
  });
  line.addEventListener("contextmenu", e => {
    e.preventDefault();
    svg.removeChild(line);
    state.allConnections = state.allConnections.filter(conn => conn.line !== line);
    if (state.selectedConnection === line) state.selectedConnection = null;
    socket.emit("connection-deleted", {
      fromId: line.dataset.from,
      toId: line.dataset.to
    });
    scheduleSVGSave();
  });
  svg.insertBefore(line, svg.firstChild);
  state.allConnections.push({ fromId, toId, line });
  socket.emit("connection-added", { fromId, toId });
  scheduleSVGSave();
}

export function highlightNode(id, on) {
  const node = state.allNodes.find(n => n.id === id);
  if (!node) return;

  const shape = node.group.querySelector('ellipse, rect');
  if (!shape) return;

  if (on) shape.classList.add('highlighted');
  else shape.classList.remove('highlighted');
}


export function addEventListenersToNode(group, id, r) {
  const node = state.allNodes.find(n => n.id === id);
  if (!node) return;

  const shape = group.querySelector('ellipse, rect');
  const text = group.querySelector('text');

  // Drag Start
  group.addEventListener('pointerdown', e => {
    const isInputClick = e.target.tagName === 'INPUT' || e.target.closest('foreignObject');
    if (isInputClick) return;
    if (e.shiftKey) return;

    const point = getSVGPoint(svg, e.clientX, e.clientY);
    dragTarget = group;
    offset.x = point.x - node.x;
    offset.y = point.y - node.y;
    shape.classList.add('dragging');
  });

  // Drag-Ende auf SVG (mouseup)
  svg.addEventListener('pointerup', (e) => {
    if (dragTarget) {
      const id = dragTarget.dataset.nodeId;
      const node = state.allNodes.find(n => n.id === id);
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
      const node = state.allNodes.find(n => n.id === id);
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
      state.selectedConnection.classList.remove('highlighted');
      state.selectedConnection = null;
    }
    if (state.selectedNode === null) {
      state.selectedNode = id;
      highlightNode(id, true);
    } else if (state.selectedNode !== id) {
      connectNodes(state.selectedNode, id);
      highlightNode(state.selectedNode, false);
      state.selectedNode = null;
    } else {
      highlightNode(state.selectedNode, false);
      state.selectedNode = null;
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

      }
      if (group.contains(fo)) {
        group.removeChild(fo);
      }

      // ----------- NEU ANFANG -------------- //
      socket.emit("node-renamed", { id, text: value })
      saveSVGToSupabase();
      // ----------- NEU ENDE -------------- //
    };
    input

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


export function createDraggableNode(x, y, type, idOverride, fromNetwork = false) {
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


  state.allNodes.push({ id, group, x, y, r: style.r });

  addEventListenersToNode(group, id, style.r);
  if (!fromNetwork) {
    socket.emit("node-added", { id, x, y, type });
  }
  scheduleSVGSave();
}

export { allNodes, allConnections, selectedNode, selectedConnection };