# Development Tools

This directory contains development and testing scripts for the AI Data Explorer project.

## Available Scripts

### Testing
- **`test-all.sh`** - Run all tests (agent + UI) with summary
- **`test-agent.sh`** - Run agent service tests only
- **`test-ui.sh`** - Run UI service tests only

### Development
- **`run-ui-local.sh`** - Run UI service locally for development

### Deployment
- **`deploy.sh`** - Deploy the application to AWS

## Usage

```bash
# Run all tests
./dev-tools/test-all.sh

# Run specific test suites
./dev-tools/test-agent.sh --all
./dev-tools/test-ui.sh

# Run UI locally for development
./dev-tools/run-ui-local.sh

# Deploy to AWS
./dev-tools/deploy.sh
```

## Test Options

**Agent Tests:**
- `./dev-tools/test-agent.sh` - Fast tests only (~2 seconds)
- `./dev-tools/test-agent.sh --all` - All tests including integration (~50 seconds)
- `./dev-tools/test-agent.sh --integration` - Agent integration tests (~4 minutes)
- `./dev-tools/test-agent.sh --coverage` - Tests with coverage report

**UI Tests:**
- `./dev-tools/test-ui.sh` - All UI integration tests (~0.2 seconds)
