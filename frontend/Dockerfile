# Dockerfile for client using Vite dev server

FROM node:23-alpine

RUN npm install -g npm@latest

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.base.json ./

RUN npm ci --legacy-peer-deps

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
