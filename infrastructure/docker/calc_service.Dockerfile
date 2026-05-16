FROM python:3.11-slim

WORKDIR /app

# Форсируем IPv4 для обхода проблем с сетью/туннелями и ставим пакеты
RUN printf 'Acquire::ForceIPv4 "true";\n' > /etc/apt/apt.conf.d/99force-ipv4 \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       libpq-dev \
       gcc \
       curl \
    && rm -rf /var/lib/apt/lists/*

# Копируем и устанавливаем зависимости (кэшируемый слой)
COPY requirements/base.txt requirements/base.txt
COPY requirements/calc.txt requirements/calc.txt
RUN pip install --no-cache-dir -r requirements/calc.txt

# Копируем исходный код самого сервиса (coefficients.json и config.py уже внутри папки!)
COPY calc_service/ /app/calc_service/

# Устанавливаем PYTHONPATH, чтобы Python видел модули внутри calc_service
ENV PYTHONPATH=/app

EXPOSE 8005

# Корректный запуск uvicorn из корня /app
CMD ["uvicorn", "calc_service.main:app", "--host", "0.0.0.0", "--port", "8005"]