FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
RUN npm ci --workspace api
COPY api/ api/
RUN npm run build --workspace api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY api/package.json api/
RUN npm ci --workspace api --omit=dev
COPY --from=build /app/api/dist api/dist
WORKDIR /app/api
USER node
EXPOSE 3000
CMD ["node", "dist/servidor.js"]
