# Basis-Image mit Node.js
#FROM node:20-alpine

# Globale Installation von http-server
#RUN npm install -g http-server

# Arbeitsverzeichnis im Container
#WORKDIR /app

# Alle Dateien ins Image kopieren
#COPY . .

# Port freigeben
#EXPOSE 8080
#
# Startbefehl
#CMD ["http-server", "-p", "8080"]

# Basis-Image
FROM node:20-alpine

# Arbeitsverzeichnis
WORKDIR /app

# Package-Dateien zuerst kopieren und Abhängigkeiten installieren
COPY package*.json ./
RUN npm install

# Projektdateien kopieren
COPY . .

# Portfreigaben (Vite + y-websocket)
EXPOSE 5173
EXPOSE 1234

# Startbefehl
CMD ["npm", "run", "start"]
