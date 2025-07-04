// realtime-sync.js
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { connectNodes } from './nodes.js';

let ydoc, yNodes, yConnections, provider, priorConnections = [];

export function initYjs(mindmapId, wsUrl = 'ws://localhost:1234') {
  ydoc = new Y.Doc();
  yNodes = ydoc.getMap('nodes');
  yConnections = ydoc.getArray('connections');
  provider = new WebsocketProvider(wsUrl, mindmapId, ydoc);
  priorConnections = yConnections.toArray();
}

export function observeYjs(allNodes, allConnections, svg) {
  yNodes.observe(event => {
    event.changes.keys.forEach((change, key) => {
      // create, update, delete nodes
      // identisch mit deinem bisherigen Code
    });
  });

  yConnections.observe(event => {
    const current = yConnections.toArray();
    const added = current.filter(
      newConn => !priorConnections.some(
        oldConn => oldConn.fromId === newConn.fromId && oldConn.toId === newConn.toId
      )
    );

    const removed = priorConnections.filter(
      oldConn => !current.some(
        newConn => newConn.fromId === oldConn.fromId && newConn.toId === oldConn.toId
      )
    );

    added.forEach(({ fromId, toId }) => {
      const exists = allConnections.some(c => c.fromId === fromId && c.toId === toId);
      if (!exists) {
        connectNodes(fromId, toId, svg, yConnections, true);
      }
    });

    removed.forEach(({ fromId, toId }) => {
      const conn = allConnections.find(c => c.fromId === fromId && c.toId === toId);
      if (conn && svg.contains(conn.line)) {
        svg.removeChild(conn.line);
      }
    });

    priorConnections = current.map(c => ({ ...c }));
  });
}

export { ydoc, yNodes, yConnections };
