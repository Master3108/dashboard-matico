FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Asegurar que existan los directorios. NO usamos USER node porque los
# volumenes bind-mount desde el host (./server/uploads, ./server/data) son
# root-owned en el VPS y al cambiar de user fallan los mkdir runtime con
# EACCES. Si se quiere endurecer en el futuro, ajustar permisos del host
# (chown 1000:1000 server/uploads server/data) y reactivar USER node.
RUN mkdir -p /app/uploads /app/data

EXPOSE 3001

CMD ["node", "index.js"]
