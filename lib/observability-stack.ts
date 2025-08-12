import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { BedrockCwDashboard } from '@cdklabs/generative-ai-cdk-constructs';

export interface ObservabilityStackProps extends cdk.StackProps {
  ocQueryLogGroup: LogGroup,
  loaderStatusLogGroup: LogGroup,
  graphSummaryLogGroup: LogGroup,
  dataLoaderLogGroup: LogGroup;
  syncKbLogGroup: LogGroup;
  dataAnalyzerLogGroup: LogGroup;
  saveDataLogGroup: LogGroup;
  schemaTranslatorLogGroup: LogGroup;
  etlProcessorLogGroup: LogGroup;
  currentDatetimeLogGroup : LogGroup;
  geoCoordinatesLogGroup: LogGroup;
  weatherLogGroup: LogGroup;
  sapOrderLogGroup: LogGroup;
}

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    // ──────────────────────────────────────────────────────────────────────────
    // Bedrock CloudWatch Dashboard Construct
    // ──────────────────────────────────────────────────────────────────────────

    // Bedrock models w/ inference profiles
    const brModels = {
      'Claude35Haiku': 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      'Claude30Haiku': 'us.anthropic.claude-3-haiku-20240307-v1:0',
      'Claude35Sonnet2': 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
      'Claude35Sonnet1': 'us.anthropic.claude-3-5-sonnet-20240620-v1:0',
      'Claude37Sonnet': 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    };    

    // Create Bedrock CW Dashboard
    const cwDb = new BedrockCwDashboard(this, 'PanopticBedrockDashboard', { dashboardName: 'Panoptic-Bedrock-Metrics' });

    // Monitoring for specific models with on-demand pricing calculation from: https://aws.amazon.com/bedrock/pricing/
    cwDb.addModelMonitoring('Claude 3.5 Haiku v1', brModels['Claude35Haiku'], { inputTokenPrice: 0.0008, outputTokenPrice: 0.004 });
    cwDb.addModelMonitoring('Claude 3 Haiku v1', brModels['Claude30Haiku'], { inputTokenPrice: 0.00025, outputTokenPrice: 0.00125 });
    cwDb.addModelMonitoring('Claude 3.5 Sonnet v2', brModels['Claude35Sonnet2'], { inputTokenPrice: 0.003, outputTokenPrice: 0.015 });    
    cwDb.addModelMonitoring('Claude 3.5 Sonnet v1', brModels['Claude35Sonnet1'], { inputTokenPrice: 0.003, outputTokenPrice: 0.015 });    
    cwDb.addModelMonitoring('Claude 3.7 Sonnet v1', brModels['Claude37Sonnet'], { inputTokenPrice: 0.003, outputTokenPrice: 0.015 });    

    // Add all models metrics
    cwDb.addAllModelsMonitoring();

    // Add all guardrails metrics
    cwDb.addAllGuardrailsMonitoring();

    // ──────────────────────────────────────────────────────────────────────────
    // Panoptic CloudWatch Dashboard
    // ──────────────────────────────────────────────────────────────────────────

    // Define the Bedrock Model Invocation Log Insights query
    const bedrockModelInvocationQuery = `fields timestamp, @message, output.outputBodyJson.metrics.latencyMs as latencyMs, errorCode, 
input.inputBodyJson.messages.0.content.0.text as inputText,
output.outputBodyJson.usage.inputTokens as inputTokens, 
output.outputBodyJson.usage.outputTokens as outputTokens, 
output.outputBodyJson.usage.totalTokens as totalTokens
parse identity.arn "*/*/" as startArn, lambdaRole, lambdaName
display timestamp, modelId, operation, lambdaName, region, inferenceRegion, latencyMs, errorCode, totalTokens, inputText, inputTokens, outputTokens`;

    // Reference existing Bedrock Model Invocation Log Group
    const bmiLogGroup = logs.LogGroup.fromLogGroupName(this, 'BMILogGroup', '/aws/bedrock/ModelInvocation');

    // Create a dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'PanopticLogsDashboard', {
      dashboardName: 'Panoptic-Monitoring',
    });

    // Create widgets
    const bedrockModelInvocationWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [bmiLogGroup.logGroupName],
      queryLines: bedrockModelInvocationQuery.split('\n'),
      width: 24,
      height: 6,
      title: 'Bedrock Model Invocation Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const oCQueryLambdaLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.ocQueryLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 24,
      height: 6,
      title: 'OCQuery Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const etlProcessorLambdaLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.etlProcessorLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'ETL Processor Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });
 
    const dataLoaderLambdaLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.dataLoaderLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'Data Loader Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const graphSummaryLambdaLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.graphSummaryLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'Graph Summary Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const saveSynthDataLambdaLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.saveDataLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'Save Synthetic Data Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const loaderStatusLambdaLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.loaderStatusLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'Loader Status Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const dataAnalyzerLambdaLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.dataAnalyzerLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'Data Analyzer Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const schemaTranslatorLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.schemaTranslatorLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'Schema Translator Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const currentDatetimeLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.currentDatetimeLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'Current Datetime Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const geoCoordinatesLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.geoCoordinatesLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'Geo Coordinates Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const weatherLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.weatherLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'Weather Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });

    const sapOrderLogGroupWidget = new cloudwatch.LogQueryWidget({
      logGroupNames: [props.sapOrderLogGroup.logGroupName],
      queryString: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 10000',
      width: 12,
      height: 6,
      title: 'SAP Order Lambda Logs',
      view: cloudwatch.LogQueryVisualizationType.TABLE,
    });
    
    const neptuneClusterId = cdk.Fn.importValue('DBClusterId')
    const neptuneMetrics = new cloudwatch.SingleValueWidget({
      title: 'Neptune Database',
      width: 24,
      height: 3,
      setPeriodToTimeRange: true,
      metrics: [
        new cloudwatch.Metric({
          namespace: 'AWS/Neptune',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            DBClusterIdentifier: neptuneClusterId,
          },
          statistic: 'avg',
          period: cdk.Duration.hours(1),
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/Neptune',
          metricName: 'TotalRequestsPerSec',
          dimensionsMap: {
            DBClusterIdentifier: neptuneClusterId,
          },
          statistic: 'avg',
          period: cdk.Duration.hours(1),
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/Neptune',
          metricName: 'NetworkThroughput',
          dimensionsMap: {
            DBClusterIdentifier: neptuneClusterId,
          },
          statistic: 'avg',
          period: cdk.Duration.hours(1),
        }),
      ],
    });

    // Add widgets to dashboard
    dashboard.addWidgets(
      neptuneMetrics,
      bedrockModelInvocationWidget,
      dataAnalyzerLambdaLogGroupWidget, schemaTranslatorLogGroupWidget,
      etlProcessorLambdaLogGroupWidget,
      dataLoaderLambdaLogGroupWidget, loaderStatusLambdaLogGroupWidget,
      saveSynthDataLambdaLogGroupWidget, graphSummaryLambdaLogGroupWidget,
      oCQueryLambdaLogGroupWidget, 
      currentDatetimeLogGroupWidget, geoCoordinatesLogGroupWidget,
      weatherLogGroupWidget, sapOrderLogGroupWidget
    );
  }
}
