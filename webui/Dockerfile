FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV WEBUI_PORT=5011

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5011

CMD ["node", "server.js"]
