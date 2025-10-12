#!/bin/bash

if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "No virtual environment is active"
else
    echo "Virtual environment is active: $VIRTUAL_ENV"
fi

# Navigate to the tests directory from dev-tools
cd "$(dirname "$0")/../docker/app/tests"

# Run fast tests by default, or all tests if --all is passed
if [ "$1" = "--all" ]; then
    echo "Running all tests (including integration tests)..."
    python -m pytest -v
elif [ "$1" = "--coverage" ]; then
    echo "Running tests with coverage report..."
    python -m pytest --cov=.. --cov-report=html --cov-report=term
elif [ "$1" = "--integration" ]; then
    echo "Running agent integration tests..."
    python -m pytest test_agents.py -v
else
    echo "Running fast unit tests..."
    python -m pytest test_fast.py -v
fi
