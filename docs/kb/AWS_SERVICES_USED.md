# **Architecture Overview**

### **Frontend & Access**
- **CloudFront** provides HTTPS termination and global CDN
- **Application Load Balancer** routes traffic between UI and API services
- **Cognito** handles user authentication and authorization

### **Application Layer**
- **ECS Fargate** hosts containerized services in private subnets
- **UI Service** (Flask) provides web interface on port 5000
- **Agent Service** (Python) runs multi-agent AI system on port 8000
- **VPC** with public/private subnets and NAT Gateway for outbound access

### **AI/ML Services**
- **Amazon Bedrock** powers Claude models and embeddings
- **Bedrock Knowledge Bases** enable RAG for products and help documentation
- **Bedrock Guardrails** filter content for safety
- **Bedrock Flows** process ETL data transformations

### **Data Layer**
- **Neptune Graph Database** stores relationships and graph analytics
- **DynamoDB** logs bulk loads, ETL operations, and data analysis
- **S3 Buckets** store knowledge base documents and ETL data

### **Processing & Integration**
- **Lambda Functions** handle bulk loading and ETL processing
- **EventBridge** schedules automated ETL workflows
- **SQS Queues** manage ETL job processing with dead letter queues

### **Security & Monitoring**
- **IAM Roles** enforce least privilege access
- **Security Groups** control network traffic
- **CloudWatch Logs** centralize application and service logging
- **Secrets Manager** stores API credentials securely

### **Key Data Flows**
- **User Requests**: CloudFront → ALB → UI → Agent → Bedrock
- **Bulk Loading**: Agent → Lambda → Neptune → DynamoDB logging
- **ETL Pipeline**: EventBridge → Lambda → Bedrock Flows → S3 → Neptune

---
# AWS Services by CDK Stack

## **🏗️ Agent Fargate Stack** (`agent-fargate-stack.ts`)

### **Core Infrastructure:**
- **VPC** - Virtual Private Cloud with public/private subnets
- **Internet Gateway** - For inbound/outbound internet access
- **NAT Gateway** - For private subnet outbound access
- **ECS** - Elastic Container Service (Fargate cluster, services, task definitions)
- **ECR** - Elastic Container Registry (via ECR Assets)
- **Application Load Balancer** - HTTP load balancing
- **CloudFront** - CDN with HTTPS termination
- **Security Groups** - Network security

### **Storage & Data:**
- **S3** - Knowledge base document storage
- **S3 Deployment** - Automated file uploads

### **Authentication & Security:**
- **Cognito** - User pools, groups, UI customization
- **Secrets Manager** - SAP API credentials, Cognito client secrets
- **IAM** - Roles and policies

### **AI/ML Services:**
- **Bedrock** - Claude models, knowledge bases, guardrails
- **Bedrock Knowledge Bases** - RAG for products and help

### **Monitoring:**
- **CloudWatch Logs** - Container and service logging

### **Compute:**
- **Lambda** - Knowledge base sync function

---

## **🗄️ Graph Database Stack** (`graph-db-stack.ts`)

### **Core Infrastructure:**
- **VPC** - Virtual Private Cloud (if not using existing)
- **Security Groups** - Neptune access control

### **Database & Storage:**
- **Neptune** - Graph database (cluster, instances, parameter groups, subnet groups)
- **S3** - ETL data bucket, access logs bucket
- **DynamoDB** - Multiple logging tables:
  - Data Analyzer Log
  - Schema Translator Log  
  - ETL Log
  - Bulk Load Log

### **AI/ML Services:**
- **Bedrock Flows** - ETL data processing workflows
- **Bedrock Models** - For data transformation

### **Compute:**
- **Lambda** - ETL processor, data loader functions

### **Messaging & Events:**
- **SQS** - ETL processing queues (main + DLQ)
- **EventBridge** - Scheduled ETL processing
- **S3 Event Notifications** - Trigger data loading

### **Security:**
- **IAM** - Neptune load role, Lambda execution roles

### **Monitoring:**
- **CloudWatch Logs** - Lambda function logging

---

## **📊 Summary**

### **Service Count:**
- **Agent Stack**: 12 services  
- **Graph Stack**: 10 services  
- **Total Unique Services**: 15 services (some overlap)

### **Most Critical Services:**
- **Bedrock** (AI/ML core)
- **ECS Fargate** (application hosting)
- **Neptune** (graph database)
- **CloudFront** (HTTPS termination)
- **Cognito** (authentication)

### **Architecture Pattern:**
- **Agent Stack**: Web application with AI/ML capabilities
- **Graph Stack**: Data processing and graph analytics pipeline
- **Integration**: Both stacks work together for complete AI data exploration platform
