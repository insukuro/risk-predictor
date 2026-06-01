# Build stage
FROM node:20-alpine as builder
WORKDIR /app

COPY cabg_docs/package*.json ./
RUN npm ci

COPY cabg_docs/ ./
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]