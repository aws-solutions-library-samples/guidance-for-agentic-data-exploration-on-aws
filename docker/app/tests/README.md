# Testing Guide

## Test Structure

This project uses a layered testing approach with different types of tests that have different requirements:

### Unit Tests (No AWS Credentials Required)

These tests are fully mocked and run quickly without external dependencies:

- **`test_fast.py`** - Fast unit tests (~2 seconds)
  - API endpoint validation
  - Error handling
  - Mocked responses
  
- **`test_app.py`** - App integration tests (~4 seconds)
  - FastAPI endpoint testing
  - Request/response validation
  
- **`test_supervisor.py`** - Supervisor agent tests
  - Agent routing logic
  - System prompt validation
  - Mocked agent responses
  
- **`test_help_assistant.py`** - Help assistant tests
  - Knowledge base integration (mocked)
  - Fallback behavior
  - Agent creation logic
  
- **`test_graph_assistant.py`** - Graph assistant tests
  - Neptune integration (mocked)
  - Bedrock integration (mocked)
  - Error handling scenarios

### Integration Tests (Optional AWS Credentials)

These tests can use real AWS services for end-to-end validation:

- **`test_agents.py`** - Multi-agent integration tests (~50 seconds)
  - Full agent routing with real API calls
  - Cross-agent communication
  - Uses FastAPI TestClient (handles mocking internally)

## Running Tests

### Local Development

```bash
# Fast unit tests only
./dev-tools/test-agent.sh

# All tests including integration
./dev-tools/test-agent.sh --all

# With coverage report
./dev-tools/test-agent.sh --coverage

# Specific test file
cd docker/app/tests
python -m pytest test_fast.py -v
```

### CI/CD (GitHub Actions)

All tests run without AWS credentials in the build pipeline:

```bash
# Runs automatically on push/PR
python -m pytest test_fast.py test_app.py test_supervisor.py test_help_assistant.py test_graph_assistant.py -v
```

## Test Categories

| Test Type | AWS Creds | Speed | Purpose |
|-----------|-----------|-------|---------|
| Unit | ❌ No | Fast | Logic validation |
| Integration | ✅ Optional | Slow | End-to-end validation |

## Mocking Strategy

Unit tests use comprehensive mocking to avoid external dependencies:

- **Bedrock API calls** - Mocked with `@patch('agents.*.Agent')`
- **Neptune connections** - Mocked with `@patch('boto3.client')`
- **Knowledge Base queries** - Mocked with `@patch('boto3.client')`
- **File operations** - Mocked responses and error scenarios

## Best Practices

1. **Unit tests should never require AWS credentials**
2. **Mock external dependencies at the module level**
3. **Test both success and error scenarios**
4. **Keep unit tests fast (< 5 seconds per file)**
5. **Use descriptive test names and docstrings**
6. **Verify mocks are called correctly**

## Troubleshooting

### NoCredentialsError in Unit Tests

If you see `botocore.exceptions.NoCredentialsError` in unit tests:

1. Check that the Agent is properly mocked
2. Ensure mocking is at the correct module level
3. Verify the test doesn't make real AWS API calls

### Slow Test Performance

If tests are running slowly:

1. Check for unmocked external API calls
2. Verify mocks are returning immediately
3. Consider moving slow tests to integration category

## Adding New Tests

When adding new tests:

1. **Unit tests** - Mock all external dependencies
2. **Integration tests** - Can use real AWS services
3. **Follow naming convention** - `test_*.py`
4. **Add to GitHub Actions** if it's a unit test
5. **Document any special requirements**
