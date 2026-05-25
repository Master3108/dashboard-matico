FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Asegurar permisos para uploads y data
RUN mkdir -p /app/uploads /app/data && chown -R node:node /app/uploads /app/data

EXPOSE 3001

USER node
CMD ["node", "index.js"]
