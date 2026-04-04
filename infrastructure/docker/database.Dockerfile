# Database Dockerfile - PostgreSQL with initialization
# This extends the official PostgreSQL image with custom initialization

FROM postgres:16-alpine

# Set environment variables
ENV POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres \
    POSTGRES_DB=risk_predictor_db \
    PGDATA=/var/lib/postgresql/data/pgdata

# Install additional utilities
RUN apk add --no-cache \
    postgresql-contrib \
    curl

# Copy initialization scripts
COPY ./infrastructure/docker/init-db.sql /docker-entrypoint-initdb.d/01-init.sql

# Expose PostgreSQL port
EXPOSE 5432

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD pg_isready -U postgres || exit 1

# Use the default entrypoint from the base image