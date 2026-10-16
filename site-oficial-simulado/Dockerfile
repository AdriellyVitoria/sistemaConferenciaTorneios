FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY site-oficial-simulado/package.json site-oficial-simulado/
RUN npm ci --workspace site-oficial-simulado
COPY site-oficial-simulado/ site-oficial-simulado/
RUN npm run build --workspace site-oficial-simulado

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY site-oficial-simulado/package.json site-oficial-simulado/
RUN npm ci --workspace site-oficial-simulado --omit=dev
COPY --from=build /app/site-oficial-simulado/dist site-oficial-simulado/dist
WORKDIR /app/site-oficial-simulado
USER node
EXPOSE 4000
CMD ["node", "dist/servidor.js"]
