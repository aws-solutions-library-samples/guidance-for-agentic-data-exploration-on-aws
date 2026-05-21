---
inclusion: manual
contextKey: implementation-guide
---

# AI Data Explorer Implementation & Customization Guide

This steering file provides a comprehensive guide for implementing and customizing the AI Data Explorer multi-agent system. Use this as your roadmap for understanding, deploying, and extending the project.

## Quick Start Implementation

### 1. Environment Setup

```bash
# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install -r ./docker/requirements.txt
pip install -r ./ui/requirements.txt

# Install Node.js dependencies
npm install

# Bootstrap CDK (one-time setup)
npx cdk bootstrap

# Start local development
./dev-tools/run-all-local.sh
```

**Note**: Always activate your virtual environment before working on the project:

```bash
source .venv/bin/activate
```

### 2. Basic Deployment

```bash
# Deploy to AWS with default settings
./dev-tools/deploy.sh --region us-east-1

# Deploy with specific AWS profile
./dev-tools/deploy.sh --profile my-profile --region us-east-1

# Deploy with Neptune graph database
./dev-tools/deploy.sh --region us-east-1 --with-graph-db

# Dry-run to validate without deploying
./dev-tools/deploy.sh --dry-run --region us-east-1

# CloudShell deployment (no local setup required)
./scripts/cloudshell-deploy.sh --region us-east-1
```

## Architecture Understanding

### Multi-Agent System Flow

1. **User Query** → Web UI (Flask)
2. **Web UI** → Agent Service (FastAPI)
3. **Supervisor Agent** → Classifies and routes to specialized agents
4. **Specialized Agent** → Processes request using tools and LLMs
5. **Response** → Streams back through UI with conversation history

### Key Components

- **Supervisor Agent**: Routes queries based on content classification
- **Specialized Agents**: Domain-specific processing (weather, data viz, etc.)
- **Tools**: External API integrations and data processing functions
- **Web UI**: Chat interface with file upload and streaming responses

## Customization Patterns

### Adding a New Specialized Agent

#### Step 1: Create Agent File

Create `docker/app/agents/your_agent_assistant.py`:

```python
from strands import Agent
from .your_tools import your_tool_function

your_agent = Agent(
    name="Your Agent Name",
    instructions="""
    You are a specialized agent for [domain].
    Your role is to [specific responsibilities].
    Always [specific behaviors].
    """,
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    tools=[your_tool_function]
)
```

#### Step 2: Create Tools File

Create `docker/app/agents/your_tools.py`:

```python
def your_tool_function(parameter: str) -> str:
    """
    Tool description for the LLM.

    Args:
        parameter: Description of parameter

    Returns:
        Description of return value
    """
    # Implementation here
    return result
```

#### Step 3: Update Supervisor Agent

Add classification logic in `docker/app/agents/supervisor_agent.py`:

```python
# Add to classification logic
elif "your_domain_keywords" in query.lower():
    return "your_agent"
```

#### Step 4: Register Agent

Add to `docker/app/app.py`:

```python
from agents.your_agent_assistant import your_agent

# Add to agents dictionary
agents = {
    # ... existing agents
    "your_agent": your_agent,
}
```

### Customizing Existing Agents

#### Modify Agent Instructions

Edit the `instructions` parameter in any agent file:

```python
agent = Agent(
    name="Agent Name",
    instructions="""
    Modified instructions here.
    Add specific behaviors, constraints, or domain knowledge.
    """,
    # ... rest of configuration
)
```

#### Add New Tools to Existing Agents

```python
# In agent file
from .additional_tools import new_tool

agent = Agent(
    # ... existing config
    tools=[existing_tool, new_tool]  # Add new tool
)
```

### UI Customization

#### Modify Chat Interface

Edit `ui/templates/chat.html` for:

- Custom styling and branding
- Additional input fields
- Modified response formatting

#### Add New Pages

1. Create template in `ui/templates/your_page.html`
2. Add route in `ui/app.py`:

```python
@app.route('/your-page')
def your_page():
    return render_template('your_page.html')
```

#### Customize Navigation

Edit `ui/templates/includes/navigation.html` to add menu items.

## Infrastructure Customization

### CDK Stack Modifications

#### Modify Fargate Configuration

Edit `lib/agent-fargate-stack.ts`:

- Change container resources (CPU, memory)
- Add environment variables
- Modify load balancer settings
- Add additional services

#### Add New AWS Services

Create new stack files following the pattern:

```typescript
// lib/your-service-stack.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class YourServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Your AWS resources here
  }
}
```

### Environment Configuration

#### Development Environment Variables

Create `.env` file in project root:

```bash
# Local development overrides
BEDROCK_REGION=us-east-1
DEBUG_MODE=true
CUSTOM_SETTING=value
```

#### Production Configuration

Modify CDK stacks to add environment variables:

```typescript
environment: {
  'CUSTOM_SETTING': 'production_value',
  // ... other variables
}
```

## Testing & Validation

### Agent Testing

```bash
# Test specific agent functionality
./dev-tools/test-agent.sh

# Test with coverage
./dev-tools/test-agent.sh --coverage

# Test all including integration tests
./dev-tools/test-agent.sh --all
```

### UI Testing

```bash
# Test web interface
./dev-tools/test-ui.sh
```

### Custom Test Creation

Add tests in `docker/app/tests/test_your_feature.py`:

```python
import pytest
from agents.your_agent_assistant import your_agent

def test_your_agent_functionality():
    response = your_agent.run("test query")
    assert "expected_content" in response.messages[-1].content
```

## Deployment Strategies

### Development Deployment

```bash
# Local development with tracing
./dev-tools/run-with-tracing.sh

# UI only (connects to AWS backend)
./dev-tools/run-ui-local.sh --aws
```

### Production Deployment

```bash
# Standard deployment
./dev-tools/deploy.sh --region us-east-1

# With specific AWS profile
./dev-tools/deploy.sh --profile prod --region us-east-1

# With custom VPC
./dev-tools/deploy.sh --region us-east-1 --vpc-id vpc-your-id

# Enterprise deployment with bring-your-own networking
./dev-tools/deploy.sh --profile prod --region us-east-1 \
  --vpc-id vpc-123 \
  --public-subnet-ids subnet-pub1,subnet-pub2 \
  --private-subnet-ids subnet-priv1,subnet-priv2 \
  --alb-security-group-id sg-alb \
  --ecs-security-group-id sg-ecs

# With monitoring and graph database
./dev-tools/deploy.sh --region us-east-1 --with-graph-db
```

### CloudShell Deployment

Use `./scripts/cloudshell-deploy.sh --region us-east-1` for deployment without local setup requirements.

## Common Customization Scenarios

### 1. Adding External API Integration

- Create tool function in `agents/your_tools.py`
- Add API credentials to environment variables
- Register tool with relevant agent
- Add error handling and rate limiting

### 2. Custom Data Processing

- Add data processing functions to tools
- Integrate with existing data visualization agent
- Add file upload support for new formats
- Create custom chart types

### 3. Authentication Integration

- Modify CDK to configure Cognito settings
- Update UI templates for login/logout
- Add user session management
- Implement role-based access control

### 4. Performance Optimization

- Adjust Fargate task resources in CDK
- Implement caching strategies
- Optimize agent tool execution
- Add CloudWatch monitoring

## Troubleshooting Guide

### Common Issues

1. **Agent not responding**: Check supervisor routing logic
2. **Tool errors**: Verify API credentials and network access
3. **UI not loading**: Check Fargate service health and ALB configuration
4. **Deployment failures**: Verify CDK bootstrap and AWS permissions

### Debug Mode

Enable debug mode in UI for detailed request/response logging:

```python
# In ui/app.py
app.config['DEBUG'] = True
```

### Logging and Monitoring

- Check CloudWatch logs for Fargate services
- Use OpenTelemetry tracing for request flow analysis
- Monitor CloudWatch dashboards for system health

## Best Practices

### Agent Development

- Keep agent instructions clear and specific
- Use descriptive tool function names and docstrings
- Implement proper error handling in tools
- Test agents with various input scenarios

### Infrastructure

- Use CDK constructs for reusable components
- Implement proper IAM roles with least privilege
- Use environment-specific configurations
- Monitor costs and resource usage

### Security

- Never hardcode credentials in code
- Use AWS Secrets Manager for sensitive data
- Implement proper CORS settings
- Regular security updates for dependencies

This guide provides the foundation for implementing and customizing the AI Data Explorer. Refer to specific files and follow the patterns established in the existing codebase for consistency.
