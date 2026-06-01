---
sidebar_position: 5
---

# Развёртка (Deployment)

## Быстрый старт

```bash
# 1. Клонируем репозиторий
git clone https://github.com/Kilisaki/risk-predictor
cd risk-predictor

# 2. Копируем и заполняем .env
cp .env.example .env
nano .env  # указать пароль к БД и остальные переменные

# 3. Создаём общую Docker-сеть
docker network create docker_web-network

# 4. Запускаем
docker compose up -d

# 5. Проверяем
curl http://localhost:8000/health