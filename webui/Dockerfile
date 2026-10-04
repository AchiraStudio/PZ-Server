FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV WEBUI_PORT=5011

EXPOSE 5011

CMD ["node", "server.js"]


