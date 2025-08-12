#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { UserInterfaceStack } from '../lib/user-interface-stack';
import { NeptuneBaseStack } from '../lib/neptune-base-stack'
import { ObservabilityStack } from '../lib/observability-stack';
import { BedrockAgentStack } from '../lib/bedrock-agent-stack';
import { UserStorageStack } from '../lib/user-storage-bucket';
import { DataVisualizationStack } from '../lib/data-visualizer-stack';
import { PermissionBoundaryAspect } from '../lib/permission-boundary-aspect';

const app = new cdk.App();
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: false }));

// setting this flag to false will destroy existing buckets and data when destroying stacks
// you would do this in DEV environments or where you want a smooth cleanup
const RETAIN_DATA = false;

// Get permission boundary ARN from context if provided
const permissionBoundaryArn = app.node.tryGetContext('permissionBoundary');

const neptuneBaseStack = new NeptuneBaseStack(app, 'NeptuneBaseStack', {
  stackName: 'Panoptic-Backend',
  description: "Guidance for Agentic Data Exploration on AWS (SO9600)",
  dbClusterId: 'panoptic-cluster',
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT
  },
  environment: 'test', 
  dbInstanceType: 'db.serverless',
  engineVersion: '1.4',
  minNcus: 2.5,
  maxNcus: 128,
  dbClusterPort: '8182',
  neptuneQueryTimeout: 20000,
  neptuneEnableAuditLog: 0,
  iamAuthEnabled: false,
  backupRetention: 7,
  attachBulkloadIamRole: true,
  storageEncrypted: true,
  preserveDataBuckets: RETAIN_DATA
});

const userStorageBucket = new UserStorageStack(app, 'UserStorageStack', {
  stackName: 'Panoptic-User-Storage',
  description: "Guidance for Agentic Data Exploration on AWS (SO9600)",
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  accessLogsBucket: neptuneBaseStack.accessLogsBucket,
});

const DataVisualizationAgentStack = new DataVisualizationStack(app, 'DataVisualizationStack', {
  stackName: 'Panoptic-Data-Visualizer',
  description: "Guidance for Agentic Data Exploration on AWS (SO9600)",
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  }
});
DataVisualizationAgentStack.addDependency(userStorageBucket);

const bedrockAgentStack = new BedrockAgentStack(app, 'BedrockAgentStack', {
  stackName: 'Panoptic-Bedrock-Agents',
  description: "Guidance for Agentic Data Exploration on AWS (SO9600)",
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  vpc: neptuneBaseStack.vpc,
  securityGroup: neptuneBaseStack.securityGroup,
  accessLogsBucket: neptuneBaseStack.accessLogsBucket,
  dataVisualizationAgent:DataVisualizationAgentStack.dataVisualizationAgent
})
bedrockAgentStack.addDependency(neptuneBaseStack);

const userInterfaceStack = new UserInterfaceStack(app, 'UserInterfaceStack', {
  stackName: 'Panoptic-UI',
  description: "Guidance for Agentic Data Exploration on AWS (SO9600)",
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  etlLogTable: neptuneBaseStack.etlLogTable,
  bulkLoadLogTable: neptuneBaseStack.bulkLoadLogTable,
  dataAnalyzerLogTable: neptuneBaseStack.dataAnalyzerLogTable,
  schemaTranslatorLogTable: neptuneBaseStack.schemaTranslatorLogTable,
  accessLogsBucket: neptuneBaseStack.accessLogsBucket,
});

userInterfaceStack.addDependency(bedrockAgentStack);

const observabilityStack = new ObservabilityStack(app, 'ObservabilityStack', {
  stackName: 'Panoptic-Observability',
  description: "Guidance for Agentic Data Exploration on AWS (SO9600)",
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  ocQueryLogGroup: bedrockAgentStack.ocQueryLogGroup,
  loaderStatusLogGroup: bedrockAgentStack.loaderStatusLogGroup,
  graphSummaryLogGroup: bedrockAgentStack.graphSummaryLogGroup,
  dataLoaderLogGroup: neptuneBaseStack.dataLoaderLogGroup,
  syncKbLogGroup: bedrockAgentStack.syncKbLogGroup,
  dataAnalyzerLogGroup: bedrockAgentStack.dataAnalyzerLogGroup,
  saveDataLogGroup: bedrockAgentStack.saveDataLogGroup,
  etlProcessorLogGroup: neptuneBaseStack.etlProcessorLogGroup,
  schemaTranslatorLogGroup: bedrockAgentStack.schemaTranslatorLogGroup,
  currentDatetimeLogGroup: bedrockAgentStack.currentDatetimeLogGroup,
  geoCoordinatesLogGroup: bedrockAgentStack.geoCoordinatesLogGroup,
  weatherLogGroup: bedrockAgentStack.weatherLogGroup,
  sapOrderLogGroup: bedrockAgentStack.sapOrderLogGroup,
});

observabilityStack.addDependency(bedrockAgentStack);
observabilityStack.addDependency(neptuneBaseStack);

// Apply permission boundary to all stacks if provided
if (permissionBoundaryArn) {
  // Apply to each stack individually to ensure proper scoping
  Aspects.of(neptuneBaseStack).add(new PermissionBoundaryAspect(neptuneBaseStack, permissionBoundaryArn));
  Aspects.of(userStorageBucket).add(new PermissionBoundaryAspect(userStorageBucket, permissionBoundaryArn));
  Aspects.of(DataVisualizationAgentStack).add(new PermissionBoundaryAspect(DataVisualizationAgentStack, permissionBoundaryArn));
  Aspects.of(bedrockAgentStack).add(new PermissionBoundaryAspect(bedrockAgentStack, permissionBoundaryArn));
  Aspects.of(userInterfaceStack).add(new PermissionBoundaryAspect(userInterfaceStack, permissionBoundaryArn));
  Aspects.of(observabilityStack).add(new PermissionBoundaryAspect(observabilityStack, permissionBoundaryArn));
}

observabilityStack.addDependency(bedrockAgentStack);
observabilityStack.addDependency(neptuneBaseStack);
