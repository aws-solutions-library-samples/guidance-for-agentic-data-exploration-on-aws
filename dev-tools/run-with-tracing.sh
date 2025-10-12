#!/bin/bash

# Start local tracing infrastructure and agent service
echo "Starting local tracing infrastructure..."

# Set environment variables
export ENVIRONMENT=local
export TRACING_ENABLED=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=ai-data-explorer

# Use podman-compose if available, fallback to docker-compose
if command -v podman-compose &> /dev/null; then
    COMPOSE_CMD="podman-compose"
elif command -v podman &> /dev/null; then
    COMPOSE_CMD="podman compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Start services
$COMPOSE_CMD -f docker/docker-compose.yml up -d

echo "Services started:"
echo "- Jaeger UI: http://localhost:16686"
echo "- Agent Service: http://localhost:8000"
echo "- OTEL Collector: http://localhost:4318"

echo ""
echo "To stop services: $COMPOSE_CMD -f docker/docker-compose.yml down"
echo "To view logs: $COMPOSE_CMD logs -f agent-service"
