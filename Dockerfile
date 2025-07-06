# Basis-Image
FROM node:20-alpine

# Arbeitsverzeichnis
WORKDIR /app

# Package-Dateien kopieren
COPY package*.json ./
RUN npm install

# Projektdateien kopieren
COPY . .

# App bauen (damit "dist" verfügbar ist)
RUN npm run build

# Portfreigabe: Vite Preview oder Serve (Frontend) + Socket.IO Server
EXPOSE 1235
EXPOSE 3000

# Startet Server + Static Hosting
CMD ["npm", "start"]

