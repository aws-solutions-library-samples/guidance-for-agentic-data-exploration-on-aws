# Guidance for Agentic Data Exploration on AWS

## Table of Contents

1. [Overview](#overview)
    - [Cost](#cost)
2. [Prerequisites](#prerequisites)
3. [Deployment Steps](#deployment-steps)
4. [Deployment Validation](#deployment-validation)
5. [Running the Guidance](#running-the-guidance)
6. [Next Steps](#next-steps)
7. [Cleanup](#cleanup)
8. [Common issues, and debugging](#common-issues-and-debugging)
9. [Revisions](#revisions)
10. [Notices](#notices)
11. [Authors](#authors)

## Overview 

The Guidance for Agentic Data Exploration on AWS (codename Panoptic) is a Generative AI powered solution that leverages [AI Agents](https://aws.amazon.com/bedrock/agents/) on [Amazon Bedrock](https://aws.amazon.com/bedrock/) to unify and analyze diverse data streams without traditional ETL barriers and data integration. This Guidance addresses the challenge of analyzing complex, interconnected data from multiple sources by providing a multi-agent system that can intelligently process, visualize, and extract insights from various data formats.

**Why did we build this Guidance?**

Traditional data analysis often requires extensive ETL processes and data integration efforts before meaningful insights can be extracted. This Guidance eliminates these barriers by providing specialized AI agents that can work collaboratively to process raw data, create graph representations, generate visualizations, and provide intelligent analysis without requiring upfront data transformation.

The system is comprised of specialized AI agents, each designed for specific use purposes:

| Agent | Function |
|-------|---------|
| Supervisor Agent | Delegates tasks to other collaborator agents and coordinates responses |
| Graph DB Agent | Handles all interactions with the Neptune graph database including data loading and running queries |
| Data Visualizer Agent | Generates visual representations of data including word clouds, charts and maps |
| Data Analyzer Agent | Reviews raw data samples to provide insights on contents |
| Schema Translator Agent | Analyzes relational database schemas and converts them into graph model representations |
| Weather Data Agent | Provides weather forecasts and history using the Open-Meteo open-source Free Weather API |
| Synthetic Data Agent | Creates synthetic data in Open Cypher CSV format based on a given graph schema and company type |
| Help Agent | Answers questions about the Panoptic accelerator |
| SAP Order Agent | Retrieves SAP sales order status information using the SAP OData service |

![Architecture Diagram](/assets/images/panoptic-arch.png?raw=true "Architecture Diagram")

### Cost

_You are responsible for the cost of the AWS services used while running this Guidance. As of December 2024, the cost for running this Guidance with the default settings in the US East (N. Virginia) region is approximately $150-200 per month for processing moderate workloads (10,000 agent interactions, 1GB Neptune storage, standard compute instances)._

_We recommend creating a [Budget](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) through [AWS Cost Explorer](https://aws.amazon.com/aws-cost-management/aws-cost-explorer/) to help manage costs. Prices are subject to change. For full details, refer to the pricing webpage for each AWS service used in this Guidance._

### Sample Cost Table

The following table provides a sample cost breakdown for deploying this Guidance with the default parameters in the US East (N. Virginia) Region for one month.

| AWS service | Dimensions | Cost [USD] |
| ----------- | ------------ | ------------ |
| Amazon Bedrock | 10,000 agent interactions per month (Claude 3.5 Sonnet) | $75.00 |
| Amazon Neptune | db.t3.medium instance + 1GB storage | $45.00 |
| AWS Lambda | 50,000 invocations, 512MB memory | $8.50 |
| Amazon Cognito | 1,000 active users per month | $0.00 |
| Amazon API Gateway | 100,000 REST API calls per month | $0.35 |
| Amazon CloudWatch | Standard monitoring and logging | $15.00 |
| Amazon S3 | 10GB storage + data transfer | $2.50 |
| **Total estimated monthly cost** | | **$146.35** |

## Prerequisites 

### Operating System 

These deployment instructions are optimized to best work on **macOS, Amazon Linux 2023 AMI, or Ubuntu 20.04+**. Deployment on other operating systems may require additional steps.

### Third-party tools 

Take the following steps before deployment

1. **Node.js and npm** (version 18.x or higher)
   ```bash
   # For macOS
   brew install node

   # For Amazon Linux 2023
   sudo dnf install nodejs npm -y   
   ```

2. **Docker Desktop**
   - Download and install from [Docker Desktop](https://www.docker.com/get-started/)
   - Ensure Docker is running before deployment

3. **AWS CLI** (version 2.x)
   ```bash
   # For macOS
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
   sudo installer -pkg AWSCLIV2.pkg -target /   

   # For Amazon Linux 2023
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Configure with your credentials
   aws configure
   ```

4. **AWS CDK CLI**
   ```bash
   npm install -g aws-cdk
   ```

### AWS account requirements

**Required AWS services and configurations:**

1. **Bedrock Model Access**: Enable the following foundation models in your AWS account/region:
   - Claude 3.5 Haiku v1
   - Claude 3.5 Sonnet v2
   - Claude 3.7 Sonnet
   - Amazon Titan Text Embeddings v1

2. **Bedrock Model Invocation Logging**: 
   - Enable [Bedrock model invocation logging](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html)
   - Set CloudWatch Logs destination to `/aws/bedrock/ModelInvocation`

3. **IAM Permissions**: Ensure your AWS credentials have permissions for:
   - Amazon Bedrock (model access and agent creation)
   - Amazon Neptune (database creation and management)
   - AWS Lambda (function creation and execution)
   - Amazon Cognito (user pool management)
   - AWS CloudFormation (stack deployment)
   - Amazon S3 (bucket creation and management)

### aws cdk bootstrap

This Guidance uses AWS CDK. If you are using AWS CDK for the first time, please perform the following bootstrapping in your target AWS account and region:

```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

Replace `ACCOUNT-NUMBER` with your AWS account ID and `REGION` with your target deployment region.

### Service Limits

See [Amazon Bedrock Quotas](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas.html) for more details on default limits for Amazon Bedrock Model and Agent usage. Please request service limit increases if you need higher throughput. 

### Supported Regions

This Guidance is supported in AWS regions where Amazon Bedrock and Amazon Neptune are available. Recommended regions include:
- US East (N. Virginia) - us-east-1
- US West (Oregon) - us-west-2
- Europe (Ireland) - eu-west-1
- Asia Pacific (Tokyo) - ap-northeast-1

## Deployment Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/aws-solutions-library-samples/guidance-for-agentic-data-exploration-on-aws.git
   cd guidance-for-agentic-data-exploration-on-aws
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Bootstrap AWS CDK** (if not already done)
   ```bash
   cdk bootstrap
   ```

4. **Deploy the application**
   ```bash
   cdk deploy --all --require-approval never
   ```

5. **Optional: Deploy with existing VPC**
   
   If you want to deploy into an existing VPC:
   ```bash
   cdk deploy --all --require-approval never --context vpcid=vpc-xxxxxxxxx
   ```
   
   With specific subnet IDs:
   ```bash
   cdk deploy --all --require-approval never --context vpcid=vpc-xxxxxxxxx --context dbSubnetIds=subnet-aaaaaaaa,subnet-bbbbbbbb
   ```
   
   With existing security group:
   ```bash
   cdk deploy --all --require-approval never --context vpcid=vpc-xxxxxxxxx --context dbsecuritygroup=sg-xxxxxxxxx
   ```

6. **Optional: Apply IAM Permission Boundary**

   You can specify an IAM permission boundary to be attached to all IAM roles created by the CDK:

   ```bash
   cdk deploy --all --require-approval never --context permissionBoundary=arn:aws:iam::123456789012:policy/MyPermissionBoundary
   ```

   When using an existing VPC, ensure that:
   - The VPC has at least 2 subnets in different Availability Zones
   - The subnets have appropriate routing for Neptune and Lambda connectivity
   - If using `dbSubnetIds`, ensure the subnet IDs exist in the VPC and span multiple AZs
   - If using `dbsecuritygroup`, ensure the security group allows inbound access on the Neptune port (default 8182) from the VPC CIDR or Lambda functions
   - If using private subnets, ensure they have internet access via NAT Gateway or VPC endpoints for AWS services

   **Examples:**

   ```bash
   # Deploy with existing VPC and specific subnet IDs
   cdk deploy --all --require-approval never --context vpcid=vpc-12345678 --context dbSubnetIds=subnet-aaaaaaaa,subnet-bbbbbbbb
   
   # Deploy with existing VPC and existing security group
   cdk deploy --all --require-approval never --context vpcid=vpc-12345678 --context dbsecuritygroup=sg-87654321
   
   # Deploy with all existing resources
   cdk deploy --all --require-approval never --context vpcid=vpc-12345678 --context dbSubnetIds=subnet-aaaaaaaa,subnet-bbbbbbbb --context dbsecuritygroup=sg-87654321
   
   # Deploy with new VPC but specific subnet targeting (useful for custom subnet layouts)
   cdk deploy --all --require-approval never --context dbSubnetIds=subnet-cccccccc,subnet-dddddddd
   ```

7. **Create Cognito user**
   
   After deployment, create a user in the Amazon Cognito user pool:
   ```bash
   aws cognito-idp admin-create-user \
       --user-pool-id <your-user-pool-id> \
       --username your@email.com \
       --user-attributes Name=email,Value=your@email.com \
       --temporary-password "TempPassw0rd!" \
       --message-action SUPPRESS \
       --region <your-region>
   ```

8. **Update SAP API credentials** (if using SAP integration)
   
   Navigate to AWS Secrets Manager and update the `sap_api_credential` secret with:
   ```json
   {
     "sales_order_url": "https://your-sap-base-url/sap/opu/odata/sap/API_SALES_ORDER_SRV",
     "username": "your-sap-username",
     "password": "your-sap-password"
   }
   ```

## Deployment Validation

1. **Verify CloudFormation stacks**
   
   Open the AWS CloudFormation console and verify that all stacks with names starting with `PanopticStack` show `CREATE_COMPLETE` status.

2. **Access the web application**
   
   The CDK deployment will output a CloudFront URL. Verify you can access this URL and see the login page.

## Running the Guidance 

### Initial Setup with Demo Data

1. **Access the application**
   - Open the CloudFront URL provided in the CDK outputs
   - Log in with the Cognito user credentials created during deployment

2. **Load demo graph schema**
   - Navigate to the Graph Schema Editor from the side navigation
   - Open the local file `data/demo_graph.txt`
   - Copy the content into the Graph Schema Editor
   - Select "Save Schema"

![Graph Schema Editor](/docs/docs-schema.png?raw=true "Graph Schema Editor")

3. **Upload demo data files**
   - Navigate to the Data Explorer
   - Select the File Upload icon in the chat window
   - Upload all CSV files located in the `data/csv` directory
   - Choose "Save to Graph" after upload

![File Upload](/docs/docs-fupload.png?raw=true "File Upload")

4. **Monitor data processing**
   - Navigate to the Data Classifier
   - Monitor the status of uploaded files
   - Wait for all files to show "processed" status

![Data Classifer](/docs/docs-classify.png?raw=true "Data Classifer")

5. **Load graph relationships**
   - Return to the Data Explorer
   - Select the Prompt Suggestions icon
   - Choose "Bulk load data from output-edges/"
   - Submit the command and monitor progress

![Load Edges](/docs/docs-edges.png?raw=true "Load Edges")

### Sample Interactions

Once data is loaded, try these sample queries:

**Graph Summary:**
- Select "Show me the graph summary" from Prompt Suggestions
- Expected output: Statistical overview of nodes, edges, and data distribution

![Graph Schema Summary](/docs/docs-graph.png?raw=true "Graph Schema Summary")

**Facility Analysis:**
- Select "Provide a comprehensive list of all Facilities"
- Expected output: Detailed list of facilities with properties and relationships

![List Facilities](/docs/docs-facs.png?raw=true "List Facilities")

## Next Steps

**Customization Options:**

1. **Add Custom Data Sources**
   - Load CSV and other structured data into S3 for analysis and transformation
   - Add unstructured data to specialized knowledge bases by domain
   - Integrate with additional third-party or internal APIs beyond SAP and weather services

2. **Extend Agent Capabilities**
   - Add new specialized agents for domain-specific analysis
   - Customize existing agents with additional tools and knowledge bases
   - Implement custom visualization types in the Data Visualizer Agent

## Cleanup

To avoid ongoing AWS charges, follow these cleanup steps:

1. **Delete CloudFormation stacks**
   ```bash
   cdk destroy --all
   ```

2. **Manual cleanup** (if needed)
   
   If CDK destroy fails, manually delete these resources:
   - Empty and delete S3 buckets created by the stack
   - Delete Neptune snapshots if automatic deletion is disabled
   - Remove any custom IAM policies created outside the stack

3. **Verify cleanup**

   Open the AWS CloudFormation console and verify that all stacks with names starting with `PanopticStack` show `DELETE_COMPLETE` status.

## Common issues, and debugging

**Common Issues**

1. **CDK Deployment Failures**
   - Check CloudFormation console for detailed error messages
   - Ensure you have the necessary permissions
   - Verify that all dependencies are correctly installed

2. **UI Loading Issues**
   - Check browser console for JavaScript errors
   - Verify that the AWS configuration is correctly loaded
   - Check network requests for API failures

3. **Agent Execution Errors**
   - Check CloudWatch logs for the specific agent Lambda function
   - Verify that the Bedrock model has been enabled in your account
   - Check IAM permissions for the Lambda functions

**Debugging Tips**

1. Enable verbose logging in Lambda functions by setting the `LOG_LEVEL` environment variable to `DEBUG`
2. Use the React Developer Tools browser extension for UI debugging
3. Check CloudWatch Logs for Lambda function execution logs
4. Use X-Ray tracing to identify performance bottlenecks

For any feedback, questions, or suggestions, please use the issues tab under this repository.

## Revisions

| Version | Date | Changes |
|---------|------|---------|
| 1.0.3 | July 23 2025 | Bug fixes |
| 1.0.2 | July 11 2025 | Bug fixes |
| 1.0.1| May 23 2025 | Bug fixes |
| 1.0.0 | May 15 2025 | Initial release with core agent functionality |

## Notices

**Disclaimer:**

*Customers are responsible for making their own independent assessment of the information in this Guidance. This Guidance: (a) is for informational purposes only, (b) represents AWS current product offerings and practices, which are subject to change without notice, and (c) does not create any commitments or assurances from AWS and its affiliates, suppliers or licensors. AWS products or services are provided “as is” without warranties, representations, or conditions of any kind, whether express or implied. AWS responsibilities and liabilities to its customers are controlled by AWS agreements, and this Guidance is not part of, nor does it modify, any agreement between AWS and its customers.*

## Authors

- Rob Sable
- Clay Brehm
- John Marciniak
- Sushanth Kothapally
- Rakesh Ghodasara
