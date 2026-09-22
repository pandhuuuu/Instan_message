# ==========================================
# Tahap 1: Build React Frontend
# ==========================================
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Salin dependencies frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Salin source code frontend dan build
COPY frontend/ ./
ENV NODE_OPTIONS="--openssl-legacy-provider"
RUN npm run build

# ==========================================
# Tahap 2: Runner Production
# ==========================================
FROM node:18-alpine AS runner
WORKDIR /app

# Mode production
ENV NODE_ENV=production

# Salin package.json root / backend
COPY package*.json ./
RUN npm install --production --legacy-peer-deps

# Salin source code backend
COPY backend/ ./backend

# Salin static build frontend dari Tahap 1
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Port backend default
EXPOSE 5000

# Jalankan server
CMD ["node", "backend/server.js"]
