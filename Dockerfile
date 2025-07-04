# 1. Basis-Image
FROM node:20-alpine

# 2. Arbeitsverzeichnis setzen
WORKDIR /app

# 3. package.json und lock zuerst kopieren und installieren
COPY package*.json ./
RUN npm install

# 4. Restliche Projektdateien kopieren
COPY . .

# 5. Build der Anwendung
RUN npm run build

# 6. start-dev.sh kopieren und ausführbar machen
COPY start-dev.sh .
RUN chmod +x start-dev.sh

# 7. Ports freigeben

EXPOSE 1234
EXPOSE 1235

# 8. Startbefehl
CMD ["./start-dev.sh"]
