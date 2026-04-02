# Multi-stage Dockerfile for server (dev and prod)

# Base stage
FROM node:23-alpine AS base
RUN npm install -g npm@latest
WORKDIR /app

# Development stage
FROM base AS dev
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.base.json ./
RUN rm -rf node_modules && npm install --legacy-peer-deps
COPY . .
CMD ["npm", "run", "dev"]

# Production stage - use tsx to run TypeScript directly
FROM base AS prod
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.base.json ./
RUN rm -rf node_modules && npm ci --legacy-peer-deps --omit=dev
COPY . .
CMD ["npx", "tsx", "src/main.ts"]
