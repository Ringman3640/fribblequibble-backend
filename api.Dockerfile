FROM node:latest
WORKDIR /api
COPY ./api/package*.json ./
RUN npm install
COPY ./api ./
ENTRYPOINT ["node", "server.js"]