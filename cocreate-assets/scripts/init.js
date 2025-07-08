
import { setupMindmap } from './script-core.js';
import { initializeAccessControl } from './nicknames.js';
import { initRealtimeSync } from './realtime-sync.js';
import { state } from './script-core.js';
import { initNodes } from './nodes.js';

export const mindmapId = new URLSearchParams(window.location.search).get("id");

// Stelle sicher, dass dein Web Component oder Host geladen ist
const host = document.querySelector("my-app") || document.body;
const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });

// SVG muss aus shadowRoot geholt werden
/*const svg = shadowRoot.getElementById("mindmap");

// Initialisiere alle Hauptkomponenten
setupMindmap(shadowRoot);
initializeAccessControl(shadowRoot);
initRealtimeSync(mindmapId, state.allNodes, state.allConnections, svg);*/
document.addEventListener("DOMContentLoaded", () => {
customElements.whenDefined('cocreate-mindmap').then(() => {
  const mindmapEl = document.querySelector('cocreate-mindmap');
  if (!mindmapEl) {
    console.error("Custom Element nicht gefunden");
    return;
  }
  // Warte hier auf die Verfügbarkeit des shadowRoots und des SVGs
  setTimeout(() => {
    const shadowRoot = mindmapEl.shadowRoot;
    const svg = shadowRoot.getElementById("mindmap");
    console.log("Timeout nach 1 Sekunde, SVG gefunden:", svg);
    if (svg) {
      initNodes(svg);
      setupMindmap(shadowRoot);
      initializeAccessControl(shadowRoot);
      initRealtimeSync(mindmapId, state.allNodes, state.allConnections, svg);
      // ... Rest init
    } else {
      console.error("SVG im ShadowRoot nicht gefunden!");
    }
  }, 1000);
});
});

/*document.addEventListener("DOMContentLoaded", () => {
  customElements.whenDefined('cocreate-mindmap').then(() => {
    const mindmapEl = document.querySelector('cocreate-mindmap');

    if (!mindmapEl) {
      console.error("Custom Element nicht gefunden");
      return;
    }

    mindmapEl.addEventListener('ready', () => {
    console.log("✅ Mindmap ready-Event empfangen");
      const shadowRoot = mindmapEl.shadowRoot;
      const svg = shadowRoot.getElementById("mindmap");

      console.log("✅ SVG gefunden und initNodes wird aufgerufen", svg);
     initNodes(svg);  
      setupMindmap(shadowRoot);
      initializeAccessControl(shadowRoot);
      initRealtimeSync(mindmapId, state.allNodes, state.allConnections, svg);
    });
  });
});*/


