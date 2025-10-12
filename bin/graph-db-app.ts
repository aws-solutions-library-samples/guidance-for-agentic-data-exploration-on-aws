#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GraphDbStack } from '../lib/graph-db-stack';

const app = new cdk.App();

const vpcId = app.node.tryGetContext('vpcId');

new GraphDbStack(app, 'DataExplorerGraphDbStack', {
  description: "Guidance for Agentic Data Exploration on AWS (SO9600)",
  vpcId: vpcId,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
