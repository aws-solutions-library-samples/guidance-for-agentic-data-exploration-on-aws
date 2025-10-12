#!/usr/bin/env node
import { App, Aspects } from 'aws-cdk-lib';
import { AgentFargateStack } from "../lib/agent-fargate-stack";
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new App();
// Aspects.of(app).add(new AwsSolutionsChecks());

// Main application stack
const agentStack = new AgentFargateStack(app, "DataExplorerAgentsStack", {
  description: "Guidance for Agentic Data Exploration on AWS (SO9600)",
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT || '', 
    region: process.env.CDK_DEFAULT_REGION|| '' 
  },
});
