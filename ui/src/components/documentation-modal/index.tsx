import React from 'react';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Tabs from '@cloudscape-design/components/tabs';
import Icon from '@cloudscape-design/components/icon';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import './styles.css';

interface DocumentationModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function DocumentationModal({ visible, onDismiss }: DocumentationModalProps) {
  // Function to handle smooth scrolling to agent sections
  const scrollToAgent = (event: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    event.preventDefault();
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      size="large"
      header={
        <Header
          variant="h1"
          description="Learn how to use the Panoptic Accelerator"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Badge color="blue">v1.0.1</Badge>
            </SpaceBetween>
          }
        >
          Panoptic Documentation
        </Header>
      }
    >
      <Box padding="l">
        <Tabs
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: (
                <SpaceBetween size="l">
                  <Container>
                    <div className="doc-hero">
                      <h2>👁️ Panoptic Accelerator</h2>
                      <p className="doc-lead">
                        A Generative AI powered accelerator using Amazon Bedrock to<br/>unify and analyze diverse data sets without traditional ETL barriers.
                      </p>
                    </div>
                  </Container>
                  
                  <Container header={<Header variant="h2">Key Features</Header>}>
                    <ColumnLayout columns={2} variant="text-grid">
                      <div>
                        <h3><Icon name="gen-ai" /> AI-Powered Analysis</h3>
                        <p>Leverage specialized AI agents to analyze, catalog, and visualize your data without investing in complex ETL processes.</p>
                      </div>
                      <div>
                        <h3><Icon name="group" /> Multi-Agent Collaboration</h3>
                        <p>Use a team of AI Agents to break down data silos and explore data without the limitations of traditional reporting tools.</p>
                      </div>
                      <div>
                        <h3><Icon name="share" /> Knowledge Graph</h3>
                        <p>Store and query complex relationships in Amazon Neptune for powerful knowledge graph capabilities.</p>
                      </div>
                      <div>
                        <h3><Icon name="anchor-link" /> Integration Capabilities</h3>
                        <p>Interact with other systems by connecting with internal, third-party, or public APIs to retrieve data or perform action.</p>
                      </div>
                      <div>
                        <h3><Icon name="contact" /> Natural Language Queries</h3>
                        <p>Ask questions about your data in plain English and get meaningful insights.</p>
                      </div>
                      <div>
                        <h3><Icon name="settings" /> Flexible Design</h3>
                        <p>Customize the system to your specific business needs with configurable agents and data models.</p>
                      </div>
                    </ColumnLayout>
                  </Container>
                  
                  <Container header={<Header variant="h2">Getting Started</Header>}>
                    <SpaceBetween size="m">
                      <p>
                        Panoptic is designed to simplify data analysis through a multi-agent architecture. 
                        Start by using the various data ingestion tools to prepare and load your data into the system.
                        Then, use the Data Explorer to query and visualize your data.
                      </p>
                      <div className="doc-steps">
                        <div className="doc-step">
                          <div className="doc-step-number">1</div>
                          <div className="doc-step-content">
                            <h4>Analyze Your Data</h4>
                            <p>Use the Data Analyzer to understand the structure and content of your data.</p>
                          </div>
                        </div>
                        <div className="doc-step">
                          <div className="doc-step-number">2</div>
                          <div className="doc-step-content">
                            <h4>Translate Your Schema</h4>
                            <p>Use the Schema Translator to define your graph data model.</p>
                          </div>
                        </div>
                        <div className="doc-step">
                          <div className="doc-step-number">3</div>
                          <div className="doc-step-content">
                            <h4>Save Your Schema</h4>
                            <p>Use the Graph Schema Editor to save your graph data model.</p>
                          </div>
                        </div>
                        <div className="doc-step">
                          <div className="doc-step-number">4</div>
                          <div className="doc-step-content">
                            <h4>Transform Your Data</h4>
                            <p>The Data Classifier translates CSV data into Open Cypher format.</p>
                          </div>
                        </div>
                        <div className="doc-step">
                          <div className="doc-step-number">5</div>
                          <div className="doc-step-content">
                            <h4>Load Your Data</h4>
                            <p>The Data Loader bulk loads data into the Neptune graph database.</p>
                          </div>
                        </div>
                        <div className="doc-step">
                          <div className="doc-step-number">6</div>
                          <div className="doc-step-content">
                            <h4>Explore Your Data</h4>
                            <p>Use the Data Explorer to query and visualize your data.</p>
                          </div>
                        </div>
                      </div>
                    </SpaceBetween>
                  </Container>
                </SpaceBetween>
              ),
            },
            {
              id: "data-explorer",
              label: "Data Explorer",
              content: (
                <SpaceBetween size="l">
                  <Container>
                    <div className="doc-feature-header">
                      <Icon name="gen-ai" size="big" />
                      <h2>Data Explorer</h2>
                    </div>
                    <p>
                      The Data Explorer is your primary interface for interacting with the Panoptic system. 
                      It allows you to query your data using natural language and visualize the results.
                    </p>
                  </Container>
                  
                  <Container header={<Header variant="h2">Available Agents</Header>}>
                    <div className="agent-pills">
                      <a href="#supervisor-agent" className="agent-pill" onClick={(e) => scrollToAgent(e, 'supervisor-agent')}>
                        <span className="agent-pill-icon"><Icon name="user-profile-active" size="small" /></span>
                        Supervisor
                      </a>
                      <a href="#graphdb-agent" className="agent-pill" onClick={(e) => scrollToAgent(e, 'graphdb-agent')}>
                        <span className="agent-pill-icon"><Icon name="user-profile" size="small" /></span>
                        Graph DB
                      </a>
                      <a href="#visualizer-agent" className="agent-pill" onClick={(e) => scrollToAgent(e, 'visualizer-agent')}>
                        <span className="agent-pill-icon"><Icon name="user-profile" size="small" /></span>
                        Data Visualizer
                      </a>
                      <a href="#analyzer-agent" className="agent-pill" onClick={(e) => scrollToAgent(e, 'analyzer-agent')}>
                        <span className="agent-pill-icon"><Icon name="user-profile" size="small" /></span>
                        Data Analyzer
                      </a>
                      <a href="#weather-agent" className="agent-pill" onClick={(e) => scrollToAgent(e, 'weather-agent')}>
                        <span className="agent-pill-icon"><Icon name="user-profile" size="small" /></span>
                        Weather Data
                      </a>
                      <a href="#synthetic-agent" className="agent-pill" onClick={(e) => scrollToAgent(e, 'synthetic-agent')}>
                        <span className="agent-pill-icon"><Icon name="user-profile" size="small" /></span>
                        Synthetic Data
                      </a>
                      <a href="#schema-agent" className="agent-pill" onClick={(e) => scrollToAgent(e, 'schema-agent')}>
                        <span className="agent-pill-icon"><Icon name="user-profile" size="small" /></span>
                        Schema Translator
                      </a>
                      <a href="#product-agent" className="agent-pill" onClick={(e) => scrollToAgent(e, 'product-agent')}>
                        <span className="agent-pill-icon"><Icon name="user-profile" size="small" /></span>
                        Product Data
                      </a>
                      <a href="#help-agent" className="agent-pill" onClick={(e) => scrollToAgent(e, 'help-agent')}>
                        <span className="agent-pill-icon"><Icon name="user-profile" size="small" /></span>
                        Help
                      </a>
                      <a href="#sap-agent" className="agent-pill" onClick={(e) => scrollToAgent(e, 'sap-agent')}>
                        <span className="agent-pill-icon"><Icon name="user-profile" size="small" /></span>
                        SAP Order
                      </a>
                    </div>
                    
                    <SpaceBetween size="l">
                      <div id="supervisor-agent" className="agent-card">
                        <div className="agent-header">
                          <h3><Icon name="user-profile-active" size="small" /> Supervisor Agent</h3>
                          <Badge color="green">Orchestrator</Badge>
                        </div>
                        <p>Delegates tasks to other collaborator agents and coordinates responses.</p>
                        <div className="agent-examples">
                          <h4>Specialized Actions:</h4>
                          <ul>
                            <li>Determine user intent</li>
                            <li>Route to the appropriate agent</li>
                            <li>Collect and combine collaborator responses</li>
                            <li>Generate a natural language response</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div id="graphdb-agent" className="agent-card">
                        <div className="agent-header">
                          <h3><Icon name="user-profile" size="small" /> Graph DB Agent</h3>
                          <Badge color="severity-critical">Graph Data</Badge>
                        </div>
                        <p>Handles all interactions with the Neptune graph database.</p>
                        <div className="agent-examples">
                          <h4>Specialized Actions:</h4>
                          <ul>
                            <li><strong>SchemaSummary</strong> - Show me the graph summary</li>
                            <li><strong>GraphDBQuery</strong> - Find all suppliers located in the US</li>
                            <li><strong>BulkDataLoader</strong> - Bulk load data from output-edges/</li>
                            <li><strong>BulkLoaderStatus</strong> - What is the status of bulk load job xxxxx-xxxxxx-xxxxxxxxxxxxx</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div id="product-agent" className="agent-card">
                        <div className="agent-header">
                          <h3><Icon name="user-profile" size="small" /> Product Data Agent</h3>
                          <Badge color="severity-medium">Knowledge Base</Badge>
                        </div>
                        <p>Searches for data on company products, their performance, and customer reviews.</p>
                        <div className="agent-examples">
                          <h4>Sample Commands:</h4>
                          <ul>
                            <li>Summarize all reviews for Product X</li>
                            <li>What are the top concerns that are called out in reviews for Product X?</li>
                            <li>What is the overall sentiment towards Product X?</li>
                            <li>Compare customer satisfaction between Product X and Product Y</li>
                          </ul>
                        </div>
                      </div>

                      <div id="visualizer-agent" className="agent-card">
                        <div className="agent-header">
                          <h3><Icon name="user-profile" size="small" /> Data Visualizer Agent</h3>
                          <Badge color="blue">Computer Use</Badge>
                        </div>
                        <p>Generates visual representations of your data.</p>
                        <div className="agent-examples">
                          <h4>Visualization Types:</h4>
                          <ul>
                            <li><strong>Word clouds</strong> - Create a word cloud from customer feedback</li>
                            <li><strong>Charts/graphs</strong> - Show me a bar chart of monthly sales</li>
                            <li><strong>Maps</strong> - Display customer locations on a map</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div id="analyzer-agent" className="agent-card">
                        <div className="agent-header">
                          <h3><Icon name="user-profile" size="small" /> Data Analyzer Agent</h3>
                          <Badge color="severity-critical">Graph Data</Badge>
                        </div>
                        <p>Reviews raw data samples to provide insights on contents.</p>
                        <div className="agent-examples">
                          <h4>Sample Commands:</h4>
                          <ul>
                            <li>Analyze all CSV files located at analyze/data</li>
                            <li>Analyze the file located at analyze/data/orders.csv</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div id="schema-agent" className="agent-card">
                        <div className="agent-header">
                          <h3><Icon name="user-profile" size="small" /> Schema Translator Agent</h3>
                          <Badge color="severity-critical">Graph Data</Badge>
                        </div>
                        <p>Analyzes relational database schemas and converts them into a graph model representation.</p>
                        <div className="agent-examples">
                          <h4>Sample Commands:</h4>
                          <ul>
                            <li>Convert this SQL schema to a graph model</li>
                            <li>Translate my relational database structure to Neptune format</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div id="synthetic-agent" className="agent-card">
                        <div className="agent-header">
                          <h3><Icon name="user-profile" size="small" /> Synthetic Data Agent</h3>
                          <Badge color="severity-critical">Graph Data</Badge>
                        </div>
                        <p>Creates synthetic data in Open Cypher CSV format based on a given graph schema and company type.</p>
                        <div className="agent-examples">
                          <h4>Sample Commands:</h4>
                          <ul>
                            <li>Generate product data for a retail company</li>
                            <li>Create sample inventory data with 100 products</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div id="help-agent" className="agent-card">
                        <div className="agent-header">
                          <h3><Icon name="user-profile" size="small" /> Help Agent</h3>
                          <Badge color="severity-medium">Knowledge Base</Badge>
                        </div>
                        <p>An expert in the Panoptic accelerator that provides guidance and assistance.</p>
                        <div className="agent-examples">
                          <h4>Sample Commands:</h4>
                          <ul>
                            <li>How do I use the Graph Schema Editor?</li>
                            <li>What agents are available in Panoptic?</li>
                            <li>What are the key features of Panoptic?</li>
                          </ul>
                        </div>
                      </div>

                      <div id="weather-agent" className="agent-card">
                        <div className="agent-header">
                          <h3><Icon name="user-profile" size="small" /> Weather Data Agent</h3>
                          <Badge color="severity-low">External API</Badge>
                        </div>
                        <p>Provides weather forecasts and historical data using the Open-Meteo API.</p>
                        <div className="agent-examples">
                          <h4>Sample Commands:</h4>
                          <ul>
                            <li>What's the weather forecast for New York next week?</li>
                            <li>Show me weather data for Cleveland January 1-15, 2025</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div id="sap-agent" className="agent-card">
                        <div className="agent-header">
                          <h3><Icon name="user-profile" size="small" /> SAP Order Agent</h3>
                          <Badge color="severity-low">External API</Badge>
                        </div>
                        <p>Retrieves SAP sales order status information using the SAP OData service.</p>
                        <div className="agent-examples">
                          <h4>Sample Commands:</h4>
                          <ul>
                            <li>What's the status of order #12345?</li>
                            <li>Show me all pending orders</li>
                          </ul>
                        </div>
                      </div>
                    </SpaceBetween>
                  </Container>
                  
                  <Container header={<Header variant="h2">Tips for Effective Queries</Header>}>
                    <SpaceBetween size="m">
                      <p>To get the most out of the Data Explorer, follow these tips:</p>
                      <ColumnLayout columns={2} variant="text-grid">
                        <div>
                          <h4>Be Specific</h4>
                          <p>Include relevant details in your queries, such as dates, entity names, or specific metrics.</p>
                        </div>
                        <div>
                          <h4>Use Natural Language</h4>
                          <p>Phrase your questions as you would ask a human analyst. The agents understand context and intent.</p>
                        </div>
                        <div>
                          <h4>Ask Follow-up Questions</h4>
                          <p>The agents maintain context, so you can ask follow-up questions to refine your analysis.</p>
                        </div>
                        <div>
                          <h4>Request Visualizations</h4>
                          <p>Explicitly ask for charts, graphs, or other visualizations when they would help understand the data.</p>
                        </div>
                      </ColumnLayout>
                    </SpaceBetween>
                  </Container>
                </SpaceBetween>
              ),
            },
            {
              id: "data-ingestion",
              label: "Data Ingestion",
              content: (
                <SpaceBetween size="l">
                  <Container>
                    <div className="doc-feature-header">
                      <Icon name="upload-download" size="big" />
                      <h2>Data Ingestion Tools</h2>
                    </div>
                    <p>
                      Panoptic provides several tools to help you analyze, transform, and load your data into the system.
                      Each tool serves a specific purpose in the data ingestion pipeline.
                    </p>
                  </Container>
                  
                  <Container header={<Header variant="h2">Data Analyzer</Header>}>
                    <div className="tool-card">
                      <div className="tool-icon">
                        <Icon name="search" size="large" />
                      </div>
                      <div className="tool-content">
                        <p>
                          The Data Analyzer helps you understand the structure and content of your raw data files.
                          Upload a sample of your data, and the analyzer will provide insights on:
                        </p>
                        <ul>
                          <li>Data types and formats</li>
                          <li>Primary and foreign keys</li>
                          <li>Potential relationships between entities</li>
                        </ul>
                        <p>
                          Use these insights to inform your schema design.
                        </p>
                      </div>
                    </div>
                  </Container>
                  
                  <Container header={<Header variant="h2">Schema Translator</Header>}>
                    <div className="tool-card">
                      <div className="tool-icon">
                        <Icon name="map" size="large" />
                      </div>
                      <div className="tool-content">
                        <p>
                          The Schema Translator converts relational database schemas into graph model representations.
                          This tool is used to define the schema for the graph database.
                        </p>
                        <p>
                          Simply provide your existing database schema (tables, columns, relationships), and the translator will:
                        </p>
                        <ul>
                          <li>Identify entities and their properties</li>
                          <li>Map relationships between entities</li>
                          <li>Generate a graph schema compatible with Neptune</li>
                        </ul>
                      </div>
                    </div>
                  </Container>
                  
                  <Container header={<Header variant="h2">Graph Schema Editor</Header>}>
                    <div className="tool-card">
                      <div className="tool-icon">
                        <Icon name="edit" size="large" />
                      </div>
                      <div className="tool-content">
                        <p>
                          The Graph Schema Editor allows you to create and modify your graph data model.
                          Use this tool to define:
                        </p>
                        <ul>
                          <li>Entities (nodes) in your graph</li>
                          <li>Relationships (edges) between entities</li>
                        </ul>
                        <p>
                          The editor provides a split-panel view with a text editor and a visual graph preview,
                          making it easy to see how your schema changes affect the graph structure.
                        </p>
                        <p><strong>Example Schema Format:</strong></p>
                        <div className="code-example">
                        [Customer]—(PURCHASED)→[Product]<br/>
                        [Product]—(BELONGS_TO)→[Category]<br/>
                        [Customer]—(LIVES_IN)→[City]
                        </div>
                      </div>
                    </div>
                  </Container>
                  
                  <Container header={<Header variant="h2">Data Classifier</Header>}>
                    <div className="tool-card">
                      <div className="tool-icon">
                        <Icon name="check" size="large" />
                      </div>
                      <div className="tool-content">
                        <p>
                          The Data Classifier translates your data according to your graph schema before loading it into the graph database.
                          This tool uses AI to:
                        </p>
                        <ul>
                          <li>Identify entity types in your data</li>
                          <li>Update headings to the required format</li>
                          <li>Generate edge records that define relationships between entities</li>
                        </ul>
                        <p>
                          The classifier output is then loaded into your graph database.
                        </p>
                      </div>
                    </div>
                  </Container>
                  
                  <Container header={<Header variant="h2">Data Loader</Header>}>
                    <div className="tool-card">
                      <div className="tool-icon">
                        <Icon name="upload" size="large" />
                      </div>
                      <div className="tool-content">
                        <p>
                          The Data Loader is the final step in the data ingestion pipeline, allowing you to import your
                          prepared data into the Neptune graph database. The loader supports:
                        </p>
                        <ul>
                          <li>Bulk loading from S3 buckets</li>
                          <li>OpenCypher CSV file format</li>
                          <li>Load status monitoring</li>
                        </ul>
                        <p>
                          Before loading, ensure your data is properly formatted according to your graph schema by the Data Classifier.
                          The loader will provide feedback on any issues encountered during the loading process.
                        </p>
                      </div>
                    </div>
                  </Container>
                  
                  <Container header={<Header variant="h2">Data Ingestion Workflow</Header>}>
                    <div className="workflow-diagram">
                      <div className="workflow-step">
                        <div className="workflow-icon">
                          <Icon name="search" />
                        </div>
                        <div className="workflow-label">Analyze</div>
                      </div>
                      <div className="workflow-arrow">→</div>
                      <div className="workflow-step">
                        <div className="workflow-icon">
                          <Icon name="map" />
                        </div>
                        <div className="workflow-label">Translate</div>
                      </div>
                      <div className="workflow-arrow">→</div>
                      <div className="workflow-step">
                        <div className="workflow-icon">
                          <Icon name="check" />
                        </div>
                        <div className="workflow-label">Classify</div>
                      </div>
                      <div className="workflow-arrow">→</div>
                      <div className="workflow-step">
                        <div className="workflow-icon">
                          <Icon name="upload" />
                        </div>
                        <div className="workflow-label">Load</div>
                      </div>
                      <div className="workflow-arrow">→</div>
                      <div className="workflow-step">
                        <div className="workflow-icon">
                          <Icon name="contact" />
                        </div>
                        <div className="workflow-label">Explore</div>
                      </div>
                    </div>
                    <Box margin={{ top: "l" }}>
                      <p>
                        Follow this workflow when ingesting new data into Panoptic.
                        Each step builds on the previous one, helping you create a high-quality graph database
                        that accurately represents your data and supports effective analysis.
                      </p>
                    </Box>
                  </Container>
                </SpaceBetween>
              ),
            },
            {
              id: "advanced",
              label: "Advanced Topics",
              content: (
                <SpaceBetween size="l">
                  <Container>
                    <div className="doc-feature-header">
                      <Icon name="settings" size="big" />
                      <h2>Advanced Topics</h2>
                    </div>
                    <p>
                      Explore advanced features and capabilities of the Panoptic Accelerator.
                    </p>
                  </Container>
                  
                  <Container header={<Header variant="h2">Custom Agent Development</Header>}>
                    <p>
                      Panoptic supports the development of custom agents to extend its capabilities.
                      Custom agents can be created to integrate with specific data sources, implement
                      specialized analysis techniques, or provide domain-specific functionality.
                    </p>
                    <p>
                      To create a custom agent, you'll need to:
                    </p>
                    <ol>
                      <li>Define the agent's purpose and capabilities</li>
                      <li>Implement the agent using the Bedrock Agents API</li>
                      <li>Configure the agent's knowledge base and action groups</li>
                      <li>Register the agent with the Supervisor Agent</li>
                    </ol>
                    <p>
                      For more information, refer to the <Link href="https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html" external>Amazon Bedrock Agents documentation</Link>.
                    </p>
                  </Container>
                  
                  <Container header={<Header variant="h2">Graph Database Optimization</Header>}>
                    <p>
                      As your graph database grows, you may need to optimize its performance.
                      Consider these optimization techniques:
                    </p>
                    <ColumnLayout columns={2} variant="text-grid">
                      <div>
                        <h4>Indexing</h4>
                        <p>Create appropriate indexes for frequently queried properties to improve query performance.</p>
                      </div>
                      <div>
                        <h4>Query Optimization</h4>
                        <p>Refine your Gremlin or SPARQL queries to minimize traversal steps and improve execution time.</p>
                      </div>
                      <div>
                        <h4>Data Partitioning</h4>
                        <p>Consider partitioning large graphs to improve query performance and manageability.</p>
                      </div>
                      <div>
                        <h4>Caching</h4>
                        <p>Implement caching strategies for frequently accessed data to reduce database load.</p>
                      </div>
                    </ColumnLayout>
                  </Container>
                  
                  <Container header={<Header variant="h2">Integration with Other AWS Services</Header>}>
                    <p>
                      Panoptic can be integrated with other AWS services to extend its capabilities:
                    </p>
                    <div className="integration-cards">
                      <div className="integration-card">
                        <h4>Amazon QuickSight</h4>
                        <p>Create interactive dashboards and visualizations based on your graph data.</p>
                      </div>
                      <div className="integration-card">
                        <h4>AWS Lambda</h4>
                        <p>Implement custom data processing and transformation functions.</p>
                      </div>
                      <div className="integration-card">
                        <h4>Amazon SageMaker</h4>
                        <p>Build and deploy machine learning models using your graph data.</p>
                      </div>
                      <div className="integration-card">
                        <h4>Amazon EventBridge</h4>
                        <p>Create event-driven workflows to automate data processing and analysis.</p>
                      </div>
                    </div>
                  </Container>
                </SpaceBetween>
              ),
            },
          ]}
        />
      </Box>
    </Modal>
  );
}
