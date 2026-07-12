FROM node:22-slim

WORKDIR /app
COPY package.json ./
# Kein Lockfile eingecheckt (Step 1) -> npm install. Sobald stabil: package-lock
# committen und auf `npm ci` umstellen.
RUN npm install

COPY . .

# PUBLIC_*-Variablen werden zur BUILD-Zeit in die statische Site gebacken.
# Deshalb als Build-Args durchreichen (docker-compose setzt sie).
ARG PUBLIC_API_BASE
ARG PUBLIC_BASEMAP_STYLE
ENV PUBLIC_API_BASE=$PUBLIC_API_BASE
ENV PUBLIC_BASEMAP_STYLE=$PUBLIC_BASEMAP_STYLE
RUN npm run build

EXPOSE 4321
CMD ["npm", "run", "preview", "--", "--host", "--port", "4321"]
