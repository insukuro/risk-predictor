FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ML service code
COPY ml/ ./ml/

# Expose port 8001
EXPOSE 8001

# Run ML service
CMD ["python", "-m", "uvicorn", "ml.ml_service:app", "--host", "0.0.0.0", "--port", "8001"]
