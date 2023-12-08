FROM node:latest
WORKDIR /api
COPY ./api/package*.json ./
RUN npm install
RUN npm install -g nodemon