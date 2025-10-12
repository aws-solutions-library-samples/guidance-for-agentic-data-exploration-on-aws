# AI Data Explorer - Complete User Guide & Knowledge Base

## Overview

The AI Data Explorer is a multi-agent system that intelligently routes queries to specialized AI agents through both a web interface and REST API. The system automatically determines which agent (Weather, Math, English, Language, Computer Science, Schema, or General) can best handle your request.

---

## KNOWLEDGE BASE SYSTEM

### Dual Knowledge Base Architecture

The AI Data Explorer uses two specialized knowledge bases:

**Help Knowledge Base:**
- Contains AI Data Explorer documentation, setup guides, and troubleshooting information
- Accessed by the Help Assistant for application-specific questions
- Pre-populated with comprehensive documentation during deployment

**Products Knowledge Base:**
- Contains product catalogs, specifications, warranty information, and customer reviews
- Accessed by the Product Analyst for product-related queries
- Can be populated by uploading files through the "Add to KB" feature

### Adding Content to Knowledge Base

**Via Web Interface:**
1. Upload any supported file (PDF, text, CSV, etc.)
2. Select "Add to KB" action
3. File is automatically uploaded to S3 and indexed
4. Content becomes available for future product queries

**Supported File Types for KB:**
- **PDFs**: Product manuals, specifications, catalogs
- **Text Files**: Product descriptions, reviews, documentation
- **CSV Files**: Product data, pricing, inventory information
- **Images**: Product photos (with OCR text extraction)

**Knowledge Base Sync:**
- Files uploaded via "Add to KB" trigger automatic indexing
- New content is available within minutes
- Vector embeddings created for semantic search

---

## NON-TECHNICAL USERS

### Level 100: Getting Started (Beginner)

**What is the AI Data Explorer?**
Think of it as a smart assistant that knows when to ask different experts for help. When you ask a question, it automatically sends it to the right specialist.

**How to Access:**
1. Open your web browser
2. Go to the URL provided by your administrator
3. Start typing questions in the chat box

**Basic Usage:**
- Type any question and press Enter
- The system will automatically choose the right expert
- Responses appear in real-time as they're generated
- Upload files by clicking the paperclip icon

**Example Questions:**
- "What's the weather in New York?"
- "Solve 2x + 5 = 15"
- "Analyze product specifications for smartphones"
- "What are the warranty terms for product X?"
- "Help me understand the deployment process"
- "Create a graph model for product relationships"

### Level 200: Web Interface Features (Intermediate)

**Prompt Suggestions:**
- Click the list icon (📋) next to the input box
- Browse categorized example prompts
- Click any suggestion to use it immediately

**File Upload Support:**
- Click the paperclip icon to upload files
- Supported: SQL files, CSV files, images, text documents, PDFs
- Choose from actions: Analyze, Add to Conversation, or **Add to KB**
- **Add to KB**: Uploads files directly to the products knowledge base for future queries
- The system will analyze and respond based on file content

**Conversation Management:**
- View your chat history in the sidebar
- Download conversations as text files
- Clear history using the "Clear" button
- Toggle debug mode to see technical details

**Mobile Usage:**
- The interface works on phones and tablets
- All features available on mobile devices
- Responsive design adapts to screen size

### Level 300: Advanced Web Features (Advanced)

**Debug Mode:**
- Toggle the debug switch to see:
  - Which agent handled your request
  - Processing time and technical details
  - API response structure

**Conversation History:**
- Conversations persist across browser sessions
- Export individual conversations
- Search through conversation history
- Conversations stored securely on the server

**File Processing Capabilities:**
- **SQL Files**: Schema analysis and optimization suggestions
- **Images**: Content analysis and description
- **CSV Files**: Data analysis and insights
- **Text Files**: Content analysis and summarization
- **PDFs**: Document analysis and knowledge base integration
- **Add to KB**: Direct upload to products knowledge base for future reference

---

## TECHNICAL USERS

### Level 100: System Architecture (Beginner)

**Components:**
- **Agent Service** (FastAPI): Backend API with specialized agents
- **Web UI** (Flask): Frontend chat interface
- **AWS Infrastructure**: Fargate containers with load balancer

**Available Agents:**
- **Supervisor Agent**: Routes requests to appropriate specialists
- **Product Analyst**: Product analysis, catalogs, specifications, and data modeling using products knowledge base
- **Weather Agent**: Meteorological data and forecasts
- **Schema Agent**: Database analysis and graph modeling
- **Help Assistant**: AI Data Explorer application guidance using help knowledge base
- **General Agent**: Everything else

**Deployment:**
- Containerized services running on AWS Fargate
- Application Load Balancer for high availability
- VPC with public/private subnet architecture

### Level 200: API Usage (Intermediate)

**Base Endpoints:**
```bash
# Get service URL from CloudFormation
SERVICE_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='AgentAPIEndpoint'].OutputValue" --output text)
```

**Basic API Calls:**
```bash
# Standard query
curl -X POST http://$SERVICE_URL/query \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "What is the weather in London?"}'

# Streaming response
curl -X POST http://$SERVICE_URL/query-streaming \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Solve this equation: 3x + 7 = 22"}'
```

**Conversation Management:**
```bash
# Get conversation history
curl http://$SERVICE_URL/conversation

# Clear conversation history
curl -X POST http://$SERVICE_URL/clear-conversation
```

**Response Format:**
```json
{
  "response": "The weather in London is...",
  "agent_used": "weather_agent",
  "processing_time": 1.23,
  "conversation_id": "uuid-string"
}
```

### Level 300: Advanced API Integration (Advanced)

**Error Handling:**
```python
import requests
import json

def query_agent(prompt, streaming=False):
    endpoint = "/query-streaming-with-events" if streaming else "/query"
    url = f"{SERVICE_URL}{endpoint}"
    
    try:
        response = requests.post(url, 
            json={"prompt": prompt},
            timeout=30,
            stream=streaming
        )
        response.raise_for_status()
        
        if streaming:
            for line in response.iter_lines():
                if line:
                    yield json.loads(line)
        else:
            return response.json()
            
    except requests.exceptions.Timeout:
        return {"error": "Request timeout"}
    except requests.exceptions.RequestException as e:
        return {"error": f"Request failed: {str(e)}"}
```

**File Upload via API:**
```python
def upload_file_query(file_path, prompt):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {'prompt': prompt}
        
        response = requests.post(
            f"{SERVICE_URL}/query",
            files=files,
            data=data
        )
        return response.json()
```

**Batch Processing:**
```python
def batch_queries(prompts):
    results = []
    for prompt in prompts:
        result = query_agent(prompt)
        results.append(result)
    return results
```

### Level 400: Infrastructure & Deployment (Expert)

**CDK Deployment:**
```bash
# Standard deployment (creates new VPC)
CDK_DOCKER=podman npx cdk deploy --require-approval never

# Deploy to existing VPC
CDK_DOCKER=podman npx cdk deploy \
  --context vpcId=vpc-xxxxxxxxx \
  --require-approval never

# Neptune integration
CDK_DOCKER=podman npx cdk deploy \
  --context vpcId=vpc-xxxxxxxxx \
  --context neptuneSgId=sg-xxxxxxxxx \
  --context neptuneHost=neptune.cluster-xxxxx.us-east-1.neptune.amazonaws.com \
  --require-approval never
```

**VPC Requirements:**
- **Public Subnets**: 2+ AZs, Internet Gateway routes, tagged `aws-cdk:subnet-type = Public`
- **Private Subnets**: 2+ AZs, NAT Gateway routes, tagged `aws-cdk:subnet-type = Private`
- **Security Groups**: Configured for ALB (80/443) and Fargate (8000/5000)

**Local Development:**
```bash
# UI with local backend
./dev-tools/run-ui-local.sh

# UI with AWS backend
./dev-tools/run-ui-local.sh --aws

# Local agent service
python ./docker/app/app.py
```

**Testing:**
```bash
# All tests
./dev-tools/test-all.sh

# Agent tests only
./dev-tools/test-agent.sh --all

# UI tests only
./dev-tools/test-ui.sh
```

### Level 500+: Advanced Customization (Expert+)

**Custom Agent Development:**
```python
# Add new agent in docker/app/agents/
class CustomAgent:
    def __init__(self):
        self.name = "custom_agent"
    
    def can_handle(self, prompt: str) -> bool:
        # Logic to determine if this agent should handle the prompt
        return "custom_keyword" in prompt.lower()
    
    def process(self, prompt: str) -> str:
        # Your custom processing logic
        return f"Custom response for: {prompt}"
```

**Supervisor Agent Modification:**
```python
# In docker/app/supervisor_agent.py
def classify_request(self, prompt: str) -> str:
    # Add custom classification logic
    if self.custom_agent.can_handle(prompt):
        return "custom_agent"
    # ... existing logic
```

**Configuration Management:**
The system uses dynamic configuration loading:
- **UI Suggestions**: `/ui/static/suggestions.json`
- **Agent Configuration**: Environment variables and CDK context
- **Template Variables**: Flask `render_template()` with explicit variable passing

**Security Considerations:**
- All API endpoints validate input
- File uploads are scanned and validated
- CORS configured for web UI domain only
- Security groups restrict network access
- No sensitive data logged or stored

**Performance Optimization:**
- Streaming responses for real-time feedback
- Connection pooling for database connections
- CDN for static assets
- Auto-scaling Fargate tasks based on load

**Monitoring & Debugging:**
- CloudWatch logs for all services
- Application metrics and alarms
- Debug mode in UI shows technical details
- Conversation history for troubleshooting

---

## TROUBLESHOOTING

### Common Issues

**"Service Unavailable" Error:**
- Check if AWS services are running
- Verify load balancer health checks
- Confirm security group rules

**Conversation History Not Loading:**
- Ensure `agent_service_url` template variable is set
- Check Flask route passes URL to template
- Verify AWS endpoint accessibility

**File Upload Failures:**
- Check file size limits (typically 10MB)
- Verify file type is supported
- Ensure proper Content-Type headers

**Deployment Failures:**
- Security group conflicts: Use `cdk destroy` then redeploy
- VPC subnet issues: Verify public/private subnet tags
- Permission errors: Check AWS credentials and policies

### Getting Help

**Debug Information:**
1. Enable debug mode in UI
2. Check browser developer console
3. Review CloudWatch logs
4. Test API endpoints directly

**Log Locations:**
- **Agent Service**: CloudWatch `/aws/fargate/agent-service`
- **UI Service**: CloudWatch `/aws/fargate/ui-service`
- **Load Balancer**: CloudWatch `/aws/applicationelb/`

---

## APPENDIX

### API Reference

**Endpoints:**
- `POST /query` - Standard query processing
- `POST /query-streaming` - Streaming response
- `GET /conversation` - Get conversation history
- `POST /clear-conversation` - Clear history
- `GET /health` - Health check

**Request Format:**
```json
{
  "prompt": "Your question here",
  "conversation_id": "optional-uuid"
}
```

**Response Format:**
```json
{
  "response": "Agent response",
  "agent_used": "agent_name",
  "processing_time": 1.23,
  "conversation_id": "uuid",
  "timestamp": "2025-08-23T20:58:17.254Z"
}
```

### Environment Variables

**Agent Service:**
- `NEPTUNE_HOST` - Neptune database endpoint
- `AWS_REGION` - AWS region for services
- `LOG_LEVEL` - Logging verbosity

**UI Service:**
- `AGENT_SERVICE_URL` - Backend API endpoint
- `FLASK_ENV` - Development/production mode
- `SECRET_KEY` - Flask session security

### File Support Matrix

| File Type | Max Size | Supported Operations |
|-----------|----------|---------------------|
| SQL | 1MB | Schema analysis, optimization |
| CSV | 10MB | Data analysis, insights |
| Images | 5MB | Content analysis, OCR |
| Text | 1MB | Summarization, analysis |
| JSON | 1MB | Structure analysis, validation |
