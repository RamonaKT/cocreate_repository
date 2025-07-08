// viewbox.js

/*const svg = shadowRoot.getElementById('mindmap');*/

let viewBox = { x: 0, y: 0, w: 3000, h: 2000 };
const zoomStep = 0.1;
const panStep = 50;

/**
 * Setzt die ViewBox des SVG neu.
 */
export function updateViewBox(svg) {
  svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
}

/**
 * Aktiviert Tastatursteuerung (WASD / Pfeiltasten) zur Navigation.
 */
export function enableKeyboardPan(svg) {
  document.addEventListener("keydown", (e) => {
    let changed = false;
    switch (e.key) {
      case "w":
      case "ArrowUp":
        viewBox.y -= panStep;
        changed = true;
        break;
      case "a":
      case "ArrowLeft":
        viewBox.x -= panStep;
        changed = true;
        break;
      case "s":
      case "ArrowDown":
        viewBox.y += panStep;
        changed = true;
        break;
      case "d":
      case "ArrowRight":
        viewBox.x += panStep;
        changed = true;
        break;
    }
    if (changed) updateViewBox(svg);
  });
}

/**
 * Aktiviert Mausrad-Zoom.
 */
export function enableScrollZoom(svg) {
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1 + zoomStep : 1 - zoomStep;
    viewBox.w *= zoomFactor;
    viewBox.h *= zoomFactor;
    updateViewBox(svg);
  });
}
