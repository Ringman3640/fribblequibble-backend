FROM node:latest
WORKDIR /api
COPY ./api/package*.json ./
RUN npm install