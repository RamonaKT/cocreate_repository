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
#
# Startbefehl
CMD ["http-server", "-p", "8080"]

########################
# Basis-Image mit Node.js
#FROM node:20-alpine

# Arbeitsverzeichnis
#WORKDIR /app

# Projektdateien kopieren
#COPY . .

# Abhängigkeiten installieren
#RUN npm install

# Start-Skript kopieren und ausführbar machen
#COPY start.sh .
#RUN chmod +x ./start.sh

# Ports freigeben
#EXPOSE 5173
#EXPOSE 1234

# Startbefehl
#CMD ["./start.sh"]

