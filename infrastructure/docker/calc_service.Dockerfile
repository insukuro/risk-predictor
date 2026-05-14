FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Копируем зависимости из ОБЩЕЙ папки requirements в корне
COPY requirements/base.txt requirements/base.txt
COPY requirements/calc.txt requirements/calc.txt

# Устанавливаем, указывая путь к файлу
RUN pip install --no-cache-dir -r requirements/calc.txt

# Копируем исходный код самого сервиса
COPY calc_service/ /app/calc_service/

# Чтобы импорты внутри main.py (например, из соседних папок) работали корректно
ENV PYTHONPATH=/app

EXPOSE 8005

CMD ["uvicorn", "calc_service.main:app", "--host", "0.0.0.0", "--port", "8005"]