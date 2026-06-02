# Build stage
FROM node:20-alpine as builder
WORKDIR /app

COPY cabg_docs/package*.json ./
RUN npm ci

COPY cabg_docs/ ./
RUN npm run build

# Production stage
FROM nginx:alpine

# Важно: копируем сборку в подпапку /docs, так как baseUrl = '/docs/'
RUN mkdir -p /usr/share/nginx/html/docs
COPY --from=builder /app/build /usr/share/nginx/html/docs

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]