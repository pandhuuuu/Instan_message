# ==========================================
# Stage 1: Build React Frontend
# ==========================================
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend dependencies
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy frontend source code and build
COPY frontend/ ./
ENV NODE_OPTIONS="--openssl-legacy-provider"
RUN npm run build

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:18-alpine AS runner
WORKDIR /app

# Production mode
ENV NODE_ENV=production

# Copy root / backend package.json
COPY package*.json ./
RUN npm install --production --legacy-peer-deps

# Copy backend source code
COPY backend/ ./backend

# Copy static frontend build from Stage 1
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Default backend port
EXPOSE 5000

# Run server
CMD ["node", "backend/server.js"]
