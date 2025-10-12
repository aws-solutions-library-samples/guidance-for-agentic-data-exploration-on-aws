#!/usr/bin/env node
import { App, Aspects } from 'aws-cdk-lib';
import { MonitoringDashboardStack } from "../lib/monitoring-dashboard-stack";
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new App();
// Aspects.of(app).add(new AwsSolutionsChecks());

// Monitoring dashboard stack (depends on main stack)
new MonitoringDashboardStack(app, "DataExplorerMonitoringStack", {
  description: "Guidance for Agentic Data Exploration on AWS (SO9600)",
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT || '', 
    region: process.env.CDK_DEFAULT_REGION|| '' 
  },
});
