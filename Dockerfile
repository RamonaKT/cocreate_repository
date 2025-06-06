# Basis-Image mit Node.js
FROM node:20-alpine

# Globale Installation von http-server
RUN npm install -g http-server

# Arbeitsverzeichnis im Container
WORKDIR /app

# Alle Dateien ins Image kopieren
COPY . .

# Port freigeben
EXPOSE 8080

# Startbefehl
CMD ["http-server", "-p", "8080"]
