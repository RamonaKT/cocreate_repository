// dragdrop.js

/**
 * Rechnet Mausposition in SVG-Koordinaten um.
 */
export function getSVGPoint(svg, x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

/**
 * Initialisiert Drag-Events für Knoten-Vorlagen aus der Toolbar.
 */
export function enableToolbarDrag(shadowRoot) {
  const templates = shadowRoot.querySelectorAll(".node-template");
  templates.forEach(el => {
    el.setAttribute("draggable", true);
    el.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", el.dataset.shape);
    });
  });
}

/**
 * Initialisiert Drop-Handling im SVG-Bereich.
 * 
 * @param {SVGElement} svg – das SVG-Mindmap-Element
 * @param {Function} handleDrop – Callback mit (shape, svgX, svgY)
 */
export function enableSvgDrop(svg, handleDrop) {
  svg.addEventListener("dragover", e => {
    e.preventDefault();
  });

  svg.addEventListener("drop", e => {
    e.preventDefault();
    const shape = e.dataTransfer.getData("text/plain");
    const { x, y } = getSVGPoint(svg, e.clientX, e.clientY);
    handleDrop(shape, x, y);
  });
}
