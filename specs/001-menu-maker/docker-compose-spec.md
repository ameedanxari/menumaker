# Docker Compose Development Environment Specification

**Version**: 1.0
**Phase**: Phase 1 (MVP)
**Last Updated**: 2025-11-12

---

## Overview

This document specifies the complete Docker Compose setup for local MenuMaker development. It includes all required services with proper networking, volume management, and health checks.

---

## Services Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Docker Network                      │
│                  (menumaker-dev)                     │
│                                                      │
│  ┌─────────┐  ┌─────────┐  ┌────────┐  ┌────────┐ │
│  │Frontend │  │ Backend │  │Postgres│  │ MinIO  │ │
│  │React:5173│◄─┤Node:3000│◄─┤  :5432 │  │ :9000  │ │
│  └─────────┘  └─────────┘  └────────┘  └────────┘ │
│                     │                                │
│                     ▼                                │
│               ┌─────────┐                            │
│               │ Redis   │                            │
│               │  :6379  │                            │
│               └─────────┘                            │
└─────────────────────────────────────────────────────┘
```

---

## Complete docker-compose.yml

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: menumaker-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: menumaker_dev
      POSTGRES_USER: menumaker_user
      POSTGRES_PASSWORD: menumaker_password_dev_only
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=en_US.UTF-8"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U menumaker_user -d menumaker_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - menumaker-network

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio:latest
    container_name: menumaker-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"  # S3 API
      - "9001:9001"  # Web Console
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    networks:
      - menumaker-network

  # MinIO Client (for bucket initialization)
  minio-init:
    image: minio/mc:latest
    container_name: menumaker-minio-init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 minioadmin minioadmin;
      mc mb local/menumaker-dev-dishes --ignore-existing;
      mc mb local/menumaker-dev-logos --ignore-existing;
      mc mb local/menumaker-dev-menus --ignore-existing;
      mc anonymous set download local/menumaker-dev-dishes;
      mc anonymous set download local/menumaker-dev-logos;
      mc anonymous set download local/menumaker-dev-menus;
      echo 'MinIO buckets initialized successfully';
      exit 0;
      "
    networks:
      - menumaker-network

  # Redis (for sessions, rate limiting, caching)
  redis:
    image: redis:7-alpine
    container_name: menumaker-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass redis_password_dev_only
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - menumaker-network

  # Backend API (Node.js/Fastify)
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
      target: development
    container_name: menumaker-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      # Node environment
      NODE_ENV: development
      PORT: 3000

      # Database
      DATABASE_URL: postgresql://menumaker_user:menumaker_password_dev_only@postgres:5432/menumaker_dev
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: menumaker_dev
      DB_USER: menumaker_user
      DB_PASSWORD: menumaker_password_dev_only
      DB_SSL: "false"

      # JWT Authentication
      JWT_SECRET: dev-secret-key-min-32-chars-long-replace-in-prod
      JWT_ACCESS_TOKEN_EXPIRY: 15m
      JWT_REFRESH_TOKEN_EXPIRY: 7d

      # Redis
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis_password_dev_only

      # Storage (MinIO)
      S3_ENDPOINT: http://minio:9000
      S3_REGION: us-east-1
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
      S3_BUCKET_DISHES: menumaker-dev-dishes
      S3_BUCKET_LOGOS: menumaker-dev-logos
      S3_BUCKET_MENUS: menumaker-dev-menus
      CDN_BASE_URL: http://localhost:9000

      # Google Maps API (for delivery fee calculation)
      GOOGLE_MAPS_API_KEY: ${GOOGLE_MAPS_API_KEY:-}

      # CORS
      CORS_ORIGIN: http://localhost:5173

      # Logging
      LOG_LEVEL: debug
    ports:
      - "3000:3000"
    volumes:
      - ./backend:/app
      - /app/node_modules  # Anonymous volume to prevent overwriting
      - backend_logs:/app/logs
    networks:
      - menumaker-network
    command: npm run dev  # Hot reload with nodemon

  # Frontend (React/Vite)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
      target: development
    container_name: menumaker-frontend
    restart: unless-stopped
    depends_on:
      - backend
    environment:
      - VITE_API_BASE_URL=http://localhost:3000/api/v1
      - VITE_CDN_BASE_URL=http://localhost:9000
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules  # Anonymous volume
    networks:
      - menumaker-network
    command: npm run dev -- --host 0.0.0.0

  # Adminer (Database UI - optional, for debugging)
  adminer:
    image: adminer:latest
    container_name: menumaker-adminer
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      ADMINER_DEFAULT_SERVER: postgres
      ADMINER_DESIGN: nette
    ports:
      - "8080:8080"
    networks:
      - menumaker-network

volumes:
  postgres_data:
    driver: local
  minio_data:
    driver: local
  redis_data:
    driver: local
  backend_logs:
    driver: local

networks:
  menumaker-network:
    driver: bridge
```

---

## Service Details

### PostgreSQL Database

**Image:** `postgres:15-alpine`
**Purpose:** Primary application database

**Configuration:**
- Database: `menumaker_dev`
- User: `menumaker_user`
- Password: `menumaker_password_dev_only` (dev only!)
- Port: `5432` (exposed to host for debugging)
- Encoding: UTF-8
- Locale: en_US.UTF-8

**Volumes:**
- `postgres_data:/var/lib/postgresql/data` - Persistent database storage
- `./scripts/init-db.sql` - Initial schema (optional)

**Health Check:**
```bash
pg_isready -U menumaker_user -d menumaker_dev
```

**Accessing from Host:**
```bash
psql -h localhost -p 5432 -U menumaker_user -d menumaker_dev
# Password: menumaker_password_dev_only
```

---

### MinIO (S3-Compatible Storage)

**Image:** `minio/minio:latest`
**Purpose:** Local S3-compatible object storage for images

**Configuration:**
- Root User: `minioadmin`
- Root Password: `minioadmin`
- S3 API Port: `9000`
- Web Console Port: `9001`

**Buckets Created:**
- `menumaker-dev-dishes` (public read)
- `menumaker-dev-logos` (public read)
- `menumaker-dev-menus` (public read)

**Volumes:**
- `minio_data:/data` - Persistent object storage

**Accessing Web Console:**
```
http://localhost:9001
Username: minioadmin
Password: minioadmin
```

**S3 Endpoint:**
```
http://localhost:9000
```

---

### MinIO Initialization Container

**Image:** `minio/mc:latest`
**Purpose:** One-time bucket setup on first run

**Actions:**
1. Adds MinIO alias as "local"
2. Creates 3 buckets (dishes, logos, menus)
3. Sets public read policy on all buckets
4. Exits successfully

**Note:** Runs once per `docker-compose up`, idempotent (safe to re-run).

---

### Redis

**Image:** `redis:7-alpine`
**Purpose:** Session storage, rate limiting, caching

**Configuration:**
- Port: `6379`
- Password: `redis_password_dev_only`
- Persistence: AOF (Append-Only File) enabled

**Volumes:**
- `redis_data:/data` - Persistent cache storage

**Health Check:**
```bash
redis-cli --raw incr ping
```

**Accessing from Host:**
```bash
redis-cli -h localhost -p 6379 -a redis_password_dev_only
```

---

### Backend API (Node.js/Fastify)

**Build Context:** `./backend/Dockerfile.dev`
**Purpose:** REST API server

**Port:** `3000` (exposed to host)

**Volumes:**
- `./backend:/app` - Source code (hot reload)
- `/app/node_modules` - Anonymous volume (prevents overwrite)
- `backend_logs:/app/logs` - Persistent logs

**Command:** `npm run dev` (nodemon with hot reload)

**Dependencies:**
- PostgreSQL (healthy)
- Redis (healthy)
- MinIO (healthy)

**Environment Variables:** See complete list in docker-compose.yml above.

---

### Frontend (React/Vite)

**Build Context:** `./frontend/Dockerfile.dev`
**Purpose:** Web application UI

**Port:** `5173` (exposed to host)

**Volumes:**
- `./frontend:/app` - Source code (hot reload)
- `/app/node_modules` - Anonymous volume

**Command:** `npm run dev -- --host 0.0.0.0`

**Environment Variables:**
- `VITE_API_BASE_URL=http://localhost:3000/api/v1`
- `VITE_CDN_BASE_URL=http://localhost:9000`

---

### Adminer (Database UI)

**Image:** `adminer:latest`
**Purpose:** Web-based database management UI (optional, for debugging)

**Port:** `8080`

**Accessing:**
```
http://localhost:8080

System: PostgreSQL
Server: postgres
Username: menumaker_user
Password: menumaker_password_dev_only
Database: menumaker_dev
```

---

## Dockerfile Specifications

### Backend Dockerfile.dev

```dockerfile
# backend/Dockerfile.dev
FROM node:20-alpine AS base

# Install dependencies for Sharp.js (image processing)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

WORKDIR /app

# Development stage
FROM base AS development

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies)
RUN npm ci

# Copy application source
COPY . .

# Expose port
EXPOSE 3000

# Start with nodemon for hot reload
CMD ["npm", "run", "dev"]
```

### Frontend Dockerfile.dev

```dockerfile
# frontend/Dockerfile.dev
FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server with host binding
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

---

## Database Initialization Script

Create `scripts/init-db.sql` for optional initial setup:

```sql
-- scripts/init-db.sql
-- This file runs automatically on first PostgreSQL container startup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set default timezone
SET timezone = 'UTC';

-- Create initial schema (optional - TypeORM will handle migrations)
-- Uncomment if you want to pre-create tables

-- CREATE TABLE IF NOT EXISTS users (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   email VARCHAR(255) UNIQUE NOT NULL,
--   password_hash VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT NOW()
-- );

-- Insert test data (development only)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'test@example.com') THEN
--     INSERT INTO users (email, password_hash)
--     VALUES ('test@example.com', '$2b$10$... (bcrypt hash)');
--   END IF;
-- END $$;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'MenuMaker database initialized successfully';
END $$;
```

---

## Usage Instructions

### Starting the Development Environment

```bash
# Clone repository
git clone <repository-url>
cd MenuMaker

# Create .env file (for secrets)
cp .env.example .env
# Edit .env and add GOOGLE_MAPS_API_KEY

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Check service health
docker-compose ps
```

**First Start Timeline:**
1. PostgreSQL starts (10-15 seconds)
2. MinIO starts (5 seconds)
3. MinIO-init creates buckets (2 seconds)
4. Redis starts (3 seconds)
5. Backend starts (10 seconds - npm install on first run)
6. Frontend starts (5 seconds)

**Total first start time:** ~30-40 seconds

### Stopping Services

```bash
# Stop all services (keep data)
docker-compose stop

# Stop and remove containers (keep volumes)
docker-compose down

# Stop and remove everything including volumes (DANGER: deletes data!)
docker-compose down -v
```

### Rebuilding Services

```bash
# Rebuild backend after dependency changes
docker-compose build backend
docker-compose up -d backend

# Rebuild all services
docker-compose build
docker-compose up -d
```

### Running Database Migrations

```bash
# Run migrations inside backend container
docker-compose exec backend npm run migration:run

# Create new migration
docker-compose exec backend npm run migration:generate -- -n AddDeliveryFields

# Revert last migration
docker-compose exec backend npm run migration:revert
```

### Accessing Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | - |
| Backend API | http://localhost:3000 | - |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| Adminer (DB UI) | http://localhost:8080 | menumaker_user / menumaker_password_dev_only |
| PostgreSQL | localhost:5432 | menumaker_user / menumaker_password_dev_only |
| Redis | localhost:6379 | redis_password_dev_only |

---

## Troubleshooting

### Port Already in Use

**Error:** `Bind for 0.0.0.0:5432 failed: port is already allocated`

**Solution:**
```bash
# Check what's using the port
lsof -i :5432

# Stop the conflicting service or change the port in docker-compose.yml
# Change "5432:5432" to "5433:5432" (map host port 5433 to container port 5432)
```

### Backend Can't Connect to Database

**Error:** `ECONNREFUSED postgres:5432`

**Solution:**
```bash
# Check if PostgreSQL is healthy
docker-compose ps

# If unhealthy, check logs
docker-compose logs postgres

# Restart services in order
docker-compose restart postgres
docker-compose restart backend
```

### MinIO Buckets Not Created

**Error:** Images return 404 or NoSuchBucket

**Solution:**
```bash
# Check minio-init logs
docker-compose logs minio-init

# Manually create buckets
docker-compose exec minio-init sh
mc alias set local http://minio:9000 minioadmin minioadmin
mc mb local/menumaker-dev-dishes
mc anonymous set download local/menumaker-dev-dishes
```

### Frontend Can't Reach Backend

**Error:** `Network Error` or `CORS Error`

**Solution:**
```bash
# 1. Check if backend is running
docker-compose ps backend

# 2. Check backend logs for errors
docker-compose logs backend

# 3. Verify CORS_ORIGIN in backend environment
docker-compose exec backend env | grep CORS_ORIGIN

# 4. Test backend directly from host
curl http://localhost:3000/api/v1/health
```

### Hot Reload Not Working

**Problem:** Code changes don't trigger rebuild

**Solution:**
```bash
# For backend:
# 1. Check nodemon is running
docker-compose exec backend ps aux | grep nodemon

# 2. Restart backend
docker-compose restart backend

# For frontend:
# 1. Check Vite dev server
docker-compose logs frontend

# 2. Restart frontend
docker-compose restart frontend
```

---

## Performance Optimization

### Faster npm install (Backend/Frontend)

Add `.dockerignore` to both backend and frontend directories:

```
# .dockerignore
node_modules
npm-debug.log
dist
build
.git
.env
.env.local
*.log
```

### Reduce Build Context Size

Only copy necessary files in Dockerfile:

```dockerfile
# Instead of COPY . .
COPY src ./src
COPY public ./public
COPY package*.json ./
COPY tsconfig.json ./
```

---

## Production Differences

**DO NOT use this docker-compose.yml in production!**

Production setup should:
- Use managed database (AWS RDS, DigitalOcean Managed DB)
- Use managed Redis (AWS ElastiCache, Redis Cloud)
- Use AWS S3 (not MinIO)
- Use environment-specific secrets (AWS Secrets Manager, Vault)
- Use HTTPS with valid SSL certificates
- Implement proper logging and monitoring
- Use multi-stage Docker builds for smaller images
- Set resource limits (CPU, memory)

---

## Environment Variables Summary

See `.env.example` specification document for complete list with descriptions.

---

**Document Status**: ✅ Complete
**Implementation Estimate**: 1 day (setup and testing)
**Dependencies**: Docker 20+, Docker Compose 2.0+
**Next**: Create docker-compose.yml → Run `docker-compose up` → Verify all services healthy
