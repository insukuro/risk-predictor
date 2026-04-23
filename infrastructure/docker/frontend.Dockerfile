# Build stage
FROM node:20-alpine as builder
WORKDIR /app

# Копируем package.json из папки frontend
COPY frontend/package*.json ./
RUN npm ci

# Копируем всё остальное содержимое frontend
COPY frontend/ ./
# VITE_API_URL берется из окружения при сборке
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage
FROM nginx:alpine
# В Vite результат обычно в dist, а не в build
COPY --from=builder /app/dist /usr/share/nginx/html
COPY infrastructure/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]