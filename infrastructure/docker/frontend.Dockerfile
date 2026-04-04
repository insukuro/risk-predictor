
# Frontend Dockerfile - React Application with Vite
# Multi-stage build for optimized production

# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Set npm config
RUN npm config set legacy-peer-deps true

# Copy package files from frontend directory
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy all frontend source code
COPY frontend/ ./

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/nginx/default.conf /etc/nginx/conf.d/default.conf

# Expose port 22000
EXPOSE 22000

CMD ["nginx", "-g", "daemon off;"]
