FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN python -m pip install setuptools
RUN python -m pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set Python path to include the app directory
ENV PYTHONPATH=/app
ENV PORT=10000
ENV GUNICORN_TIMEOUT=180
ENV GUNICORN_GRACEFUL_TIMEOUT=180

# Expose port
EXPOSE ${PORT}

# Run the application with Gunicorn
# Reduced workers for memory-constrained environments (free tier)
# Increased timeout for file uploads and email sending
CMD gunicorn app.main:app \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:${PORT} \
    --timeout ${GUNICORN_TIMEOUT} \
    --graceful-timeout ${GUNICORN_GRACEFUL_TIMEOUT} \
    --keep-alive 5 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    --log-level info 