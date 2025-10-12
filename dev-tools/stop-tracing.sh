#!/bin/bash

# Stop local tracing infrastructure and agent service
echo "Stopping local tracing infrastructure..."
podman compose down
echo "Services stopped."