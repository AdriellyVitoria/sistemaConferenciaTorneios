FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
RUN npm ci --workspace web
COPY web/ web/
RUN npm run build --workspace web
WORKDIR /app/web
USER node
EXPOSE 5173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]
