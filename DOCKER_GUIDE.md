# Docker Setup Guide for Risk Predictor

## Overview

The Risk Predictor application is fully containerized with Docker and Docker Compose. This guide explains the Docker setup and how to use it.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Docker Network                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend (Nginx)          Backend (FastAPI)   Database │
│  ┌──────────────┐         ┌─────────────┐    (PostgreSQL)
│  │  React App   │───/api─▶│  API Server │───▶ ┌────────┐
│  │   :3000      │         │   :8000     │    │ :5432  │
│  └──────────────┘         └─────────────┘    └────────┘
│                                                         │
│  └─────────────────────────────────────────────────────┘
│              Nginx Reverse Proxy (Production)
│              Ports: 80 (HTTP), 443 (HTTPS)
│
```

## Docker Files

### 1. **backend.Dockerfile**
- Multi-stage build for optimized size
- Python 3.12-slim base image
- Installs dependencies in builder stage
- Runs as non-root user (security)
- HEALTHCHECK configured
- Expose port 8000

### 2. **database.Dockerfile**
- PostgreSQL 16 Alpine (minimal)
- Custom initialization SQL
- Health check for readiness
- Volume for persistent data
- Expose port 5432

### 3. **frontend.Dockerfile**
- Multi-stage build: build stage + runtime
- Node.js for building React app
- Nginx Alpine for serving
- Gzip compression enabled
- Security headers configured
- Expose port 80

### 4. **nginx.conf**
- Reverse proxy configuration
- Serves frontend from /usr/share/nginx/html
- Proxies API requests to backend
- Security headers
- Gzip compression
- Rate limiting
- Cache control for static assets

## docker-compose.yml Services

### Services Included

1. **database** - PostgreSQL 16
   - Port: 5432
   - Volume: postgres_data
   - Environment configured for development

2. **backend** - FastAPI Application
   - Port: 8000
   - Volume: ./backend (for live development)
   - Depends on database
   - Auto-creates tables on startup

3. **frontend** - React + Nginx
   - Port: 3000
   - Built from source
   - Serves React app via Nginx

4. **nginx** (Optional - Production)
   - Port: 80 (443 for HTTPS)
   - Reverse proxy for frontend and backend
   - Profile: production

5. **redis** (Optional - Future Use)
   - Port: 6379
   - For caching
   - Profile: optional

