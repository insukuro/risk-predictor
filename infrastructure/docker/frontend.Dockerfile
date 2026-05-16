# Build stage
FROM node:20-alpine as builder
WORKDIR /app

# Копируем package.json из папки frontend
COPY frontend/package*.json ./
RUN npm ci

# Копируем всё остальное содержимое frontend
COPY frontend/ ./

# Переменные окружения для сборки Vite (должны начинаться с VITE_)
ARG VITE_API_URL=/api
ARG VITE_API_BASE_URL=/api
ARG VITE_CALC_URL=/calc

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CALC_URL=$VITE_CALC_URL

RUN npm run build

# Production stage
FROM nginx:alpine
# В Vite результат сборки попадает в dist
COPY --from=builder /app/dist /usr/share/nginx/html
COPY infrastructure/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]