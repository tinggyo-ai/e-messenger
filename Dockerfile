FROM node:22-slim AS builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM node:22-slim
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --production
COPY server/ ./
COPY --from=builder /app/server/public ./public

RUN mkdir -p /app/data/uploads

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/nexus.sqlite
ENV UPLOAD_PATH=/app/data/uploads

EXPOSE 3000
CMD ["node", "server.js"]
