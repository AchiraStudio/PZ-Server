FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV WEBUI_PORT=5011

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
RUN npm prune --omit=dev

EXPOSE 5011

CMD ["node", "server.js"]

