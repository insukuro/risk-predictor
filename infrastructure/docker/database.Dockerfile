# Database Dockerfile - PostgreSQL with initialization
FROM postgres:16-alpine

# Install additional utilities
RUN apk add --no-cache \
    postgresql-contrib \
    curl

# Copy initialization scripts
COPY ./infrastructure/docker/init-db.sql /docker-entrypoint-initdb.d/01-init.sql

# Expose PostgreSQL port
EXPOSE 5432
