FROM public.ecr.aws/docker/library/python:3.13-slim

WORKDIR /app

# Install system dependencies including build tools and fonts
RUN apt-get update && apt-get install -y \
    git \
    gcc \
    g++ \
    build-essential \
    libfreetype6-dev \
    libjpeg-dev \
    zlib1g-dev \
    fonts-dejavu-core \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Copy requirements file
COPY docker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY docker/app/ .

# Copy LLM configuration from UI directory
COPY ui/static/llm-config.json ./llm-config.json

# Create a non-root user to run the application
RUN useradd -m appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose the port the app runs on
EXPOSE 8000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Command to run the application with Uvicorn
# - workers: 2 worker processes (adjust based on container resources)
# - host: Listen on all interfaces
# - port: 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
