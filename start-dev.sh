#!/bin/sh

# Starte WebSocket-Server im Hintergrund
npx y-websocket --port 1234 --host 0.0.0.0 &

# Starte Vite im Vordergrund
npm run dev
