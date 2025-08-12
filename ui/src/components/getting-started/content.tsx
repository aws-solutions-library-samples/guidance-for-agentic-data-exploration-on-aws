import React from 'react';
import * as tokens from '@cloudscape-design/design-tokens';
import Grid from "@cloudscape-design/components/grid";
import Box from "@cloudscape-design/components/box";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import Button from "@cloudscape-design/components/button";
import Badge from "@cloudscape-design/components/badge";
import Icon from "@cloudscape-design/components/icon";
import Link from '@cloudscape-design/components/link';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import SpaceBetween from "@cloudscape-design/components/space-between";
import './base.scss';
const architectureImage = "/images/panoptic-arch.png";

interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

const ImageComponent: React.FC<ImageProps> = ({ src, alt, width, height }) => {
  return (
    <div>
      <img 
        src={src} 
        alt={alt}
        width={width}
        height={height}
        style={
          {
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
            marginLeft: 'auto',
            marginRight: 'auto',
            marginTop: '20px'
          }
        }
      />
    </div>
  );
};

const headerStyles = {
  backgroundImage: `url("/images/banner-background@0.5x.png")`, 
  backgroundBlendMode: "overlay",
  backgroundSize: "cover",
  padding: "20px 40px",
  marginBottom: "20px",
};

export function GettingStarted() {
  return (
    <Box>
      <div style={headerStyles}>
      {/* Header Section */}
      <Box padding={{ vertical: 'xxxl' }}>
      <div>
        <Header
          variant="h1"
          info={<Badge color="blue">NEW</Badge>}
          description={<span className='custom-home-text-secondary'>Get started by setting up your schema, ingesting your data, and querying it using natural language.</span>}
        >
          <span className="splash-title">Welcome to Panoptic by AWS</span>
        </Header>
        </div>
      </Box>
      </div>

      <Box padding={{ horizontal: 'xl' }}>

        {/* Cards Grid */}
        <Grid
          gridDefinition={[
            { colspan: { default: 12, xs: 4 } },
            { colspan: { default: 12, xs: 4 } },
            { colspan: { default: 12, xs: 4 } }
          ]}
        >
          {/* Prepare Account Card */}
          <Container>
            <Box padding="s">
                <Box>
                  <Header variant="h2">
                   <Icon name="search" size='medium' /> &nbsp;
                    Analyze schema
                  </Header>
                  <Box color="text-body-secondary" margin={{ top: "m" }}>
                    Upload your relational data schema definition to create a graph database schema.
                  </Box>
                  <Box margin={{ top: "m" }}>
                    <Button href='#/schema-translator'>Go to Schema Translator</Button>
                  </Box>
                </Box>
            </Box>
          </Container>

          {/* Catalog Data Card */}
          <Container>
            <Box padding="s">
              <Box>
                <Header variant="h2">
                  <Icon name="upload-download" size='medium' /> &nbsp;
                  Ingest data
                </Header>
                <Box color="text-body-secondary" margin={{ top: "m" }}>
                  Upload CSV data to be converted into OpenCypher CSV format for bulk loading into Amazon Neptune.
                </Box>
                <Box margin={{ top: "m" }}>
                  <Button href='#/data-classifier'>Go to Data Classifier</Button>
                </Box>
              </Box>
            </Box>
          </Container>

          {/* Transform Data Card */}
          <Container>
            <Box padding="s">
              <Box>
                <Header variant="h2">
                  <Icon name="share" size='medium' /> &nbsp;
                  Explore relationships
                </Header>
                <Box color="text-body-secondary" margin={{ top: "m" }}>
                  Use the Data Explorer to extract insights from your data using natural language queries.
                </Box>
                <Box margin={{ top: "m" }}>
                  <Button href='#/data-explorer'>Go to Data Explorer</Button>
                </Box>
              </Box>
            </Box>
          </Container>
        </Grid>
      </Box>

      <Box padding={{ top: 'xxl', horizontal: 'l', bottom: 'l' }}>
        <Grid
          gridDefinition={[
            { colspan: 12 }
          ]}          
        >
          <SpaceBetween size="xl">
            <Header variant="h1" headingTagOverride="h2">
              Benefits and features
            </Header>
            <Container>
              <ColumnLayout columns={2} variant="text-grid">
                <div>
                  <Box variant="h3">
                  Automated Data Integration
                  </Box>
                  <Box variant="p">
                  Panoptic automates the collection, connection, and normalization of data from across the enterprise and external sources, providing a 360-degree view of operations.                    </Box>
                </div>
                <div>
                  <Box variant="h3">
                  Real-Time Analytics with AI                    </Box>
                  <Box variant="p">
                  Seamless integration with AWS's AI capabilities enables real-time insights and actionable intelligence across the manufacturing lifecycle.                    </Box>
                </div>
                <div>
                  <Box variant="h3">
                  Security and Governance                    
                  </Box>
                  <Box variant="p">
                    Offers centralized control over data access with fine-grained permissions and comprehensive auditing capabilities.
                  </Box>
                </div>
                <div>
                  <Box variant="h3">
                  Scalable and Flexible Architecture
                  </Box>
                  <Box variant="p">
                  Provides a highly scalable and flexible environment for storing and processing massive amounts of diverse data, easily adapting to growing volumes and new data sources.                    </Box>
                </div>
              </ColumnLayout>
            </Container>
            <Header variant="h1" headingTagOverride="h2">
              Top use cases
            </Header>
            <Container>
              <ColumnLayout columns={3} variant="text-grid">
                <div>
                  <Box variant="h3">
                  Root Cause Analysis of Quality Issues                    
                  </Box>
                  <Box variant="p">
                  By connecting and analyzing diverse data sets (production line, materials, testing, environmental), Panoptic enables manufacturers to quickly identify quality issues and create automated feedback loops for areas needing improvement such as training, sourcing, or product design.
                  </Box>
                </div>
                <div>
                  <Box variant="h3">
                  Product Engineering Continuous Improvement                    
                  </Box>
                  <Box variant="p">
                  Panoptic enables real-time product optimization by correlating customer feedback, market research, performance testing, and manufacturing process data to drive faster innovation and enhanced product competitiveness.
                  </Box>
                </div>
                <div>
                  <Box variant="h3">
                  Warranty and Recall Management                    
                  </Box>
                  <Box variant="p">
                  Harness comprehensive data analysis across product performance, customer feedback, warranty claims, and service reports to identify emerging quality trends and failure patterns. Generate predictive insights and early warning indicators through automated risk assessments, enabling proactive interventions before issues impact customers.
                  </Box>
                </div>                
              </ColumnLayout>
            </Container>
            <Header variant="h1" headingTagOverride="h2">
              Services utilized
            </Header>            
            <Container>
              <ColumnLayout columns={2} variant="text-grid">
              <div>
                  <Box variant="h3">
                    <Link fontSize="heading-m" external href="https://aws.amazon.com/bedrock">
                    Amazon Bedrock                    
                    </Link>
                  </Box>
                  <Box variant="p">
                  Amazon Bedrock is a fully managed service that offers a choice of high-performing foundation models (FMs) from leading AI companies through a single API, along with a broad set of capabilities you need to build generative AI applications with security, privacy, and responsible AI. 
                  </Box>
                </div>
                <div>
                  <Box variant="h3">
                    <Link fontSize="heading-m" external href="https://aws.amazon.com/neptune">
                    Amazon Neptune
                    </Link>
                  </Box>
                  <Box variant="p">
                  Neptune Database is a serverless graph database designed for superior scalability and availability. Neptune Database provides built-in security, continuous backups, and integrations with other AWS services.
                  </Box>
                </div>
                <div>
                  <Box variant="h3">
                    <Link fontSize="heading-m" external href="https://aws.amazon.com/lambda">
                    AWS Lambda                    
                    </Link>
                  </Box>
                  <Box variant="p">AWS Lambda is a compute service that runs your code in response to events and automatically manages the compute resources, making it the fastest way to turn an idea into a modern, production, serverless applications.</Box>
                </div>
                <div>
                  <Box variant="h3">
                    <Link fontSize="heading-m" external href="https://aws.amazon.com/dynamodb">
                    Amazon DynamoDB
                    </Link>
                  </Box>
                  <Box variant="p">
                  Amazon DynamoDB is a serverless, NoSQL database service that allows you to develop modern applications at any scale. As a serverless database, you only pay for what you use and DynamoDB scales to zero, has no cold starts, no version upgrades, no maintenance windows, no patching, and no downtime maintenance.
                  </Box>
                </div>  
                <div>
                  <Box variant="h3">
                    <Link fontSize="heading-m" external href="https://aws.amazon.com/s3">
                    Amazon S3                    
                    </Link>
                  </Box>
                  <Box variant="p">
                  Amazon Simple Storage Service (Amazon S3) is an object storage service offering industry-leading scalability, data availability, security, and performance. 
                  </Box>
                </div>
                <div>
                  <Box variant="h3">
                    <Link fontSize="heading-m" external href="https://aws.amazon.com/cognito">
                    Amazon Cognito
                    </Link>
                  </Box>
                  <Box variant="p">
                  Amazon Cognito lets you add user sign-up, sign-in, and access control to your web and mobile applications within minutes.
                  </Box>
                </div>       
                <div>
                  <Box variant="h3">
                    <Link fontSize="heading-m" external href="https://aws.amazon.com/opensearch-serice">
                    Amazon OpenSearch                    
                    </Link>
                  </Box>
                  <Box variant="p">
                  Amazon OpenSearch Service securely unlocks real-time search, monitoring, and analysis of business and operational data for use cases like application monitoring, log analytics, observability, and website search.
                  </Box>
                </div>
                <div>
                  <Box variant="h3">
                    <Link fontSize="heading-m" external href="https://aws.amazon.com/cloudfront">
                    Amazon CloudFront
                    </Link>
                  </Box>
                  <Box variant="p">
                  Amazon CloudFront lets you securely deliver content with low latency and high transfer speeds.
                  </Box>
                </div>                    
              </ColumnLayout>
            </Container>
            <div>
              <Header variant="h1" headingTagOverride="h2">
                Architecture
              </Header>
              
              <ImageComponent
                src={architectureImage}
                alt="Panoptic Architecture"
              />
              
            </div>            
          </SpaceBetween>
        </Grid>
      </Box>



    </Box>

  );
}

export default GettingStarted;
