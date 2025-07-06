
import { setupMindmap } from './script-core.js';
import { initializeAccessControl } from './nicknames.js';
import { initRealtimeSync } from './realtime-sync.js';
import { allNodes, allConnections } from './nodes.js';

const mindmapId = new URLSearchParams(window.location.search).get("id");

// Stelle sicher, dass dein Web Component oder Host geladen ist
const host = document.querySelector("my-app") || document.body;
const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });

// SVG muss aus shadowRoot geholt werden
const svg = shadowRoot.getElementById("mindmap");

// Initialisiere alle Hauptkomponenten
setupMindmap(shadowRoot);
initializeAccessControl(shadowRoot);
initRealtimeSync(mindmapId, allNodes, allConnections, svg);
