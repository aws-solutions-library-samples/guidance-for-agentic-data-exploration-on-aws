import { Stack, StackProps, Fn, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as logs from "aws-cdk-lib/aws-logs";

export class MonitoringDashboardStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Import values from other stacks
    const clusterName = Fn.importValue('ECSClusterName');
    const agentServiceName = Fn.importValue('AgentServiceName');
    const uiServiceName = Fn.importValue('UIServiceName');
    const albName = Fn.importValue('ALBName');
    const distributionId = Fn.importValue('CloudFrontDistributionId');

    // Create the dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'AIDataExplorerDashboard', {
      dashboardName: 'AI-Data-Explorer-Monitoring',
      defaultInterval: Duration.minutes(5),
    });

    // ECS Cluster Overview
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# AI Data Explorer - System Overview',
        width: 24,
        height: 1,
      })
    );

    // ECS Service Metrics Row
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ECS Service - Running Tasks',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'RunningTaskCount',
            dimensionsMap: {
              ServiceName: agentServiceName,
              ClusterName: clusterName,
            },
            statistic: 'Average',
            label: 'Agent Service Tasks',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'RunningTaskCount',
            dimensionsMap: {
              ServiceName: uiServiceName,
              ClusterName: clusterName,
            },
            statistic: 'Average',
            label: 'UI Service Tasks',
          }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Service - CPU Utilization',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              ServiceName: agentServiceName,
              ClusterName: clusterName,
            },
            statistic: 'Average',
            label: 'Agent Service CPU',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              ServiceName: uiServiceName,
              ClusterName: clusterName,
            },
            statistic: 'Average',
            label: 'UI Service CPU',
          }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Service - Memory Utilization',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'MemoryUtilization',
            dimensionsMap: {
              ServiceName: agentServiceName,
              ClusterName: clusterName,
            },
            statistic: 'Average',
            label: 'Agent Service Memory',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'MemoryUtilization',
            dimensionsMap: {
              ServiceName: uiServiceName,
              ClusterName: clusterName,
            },
            statistic: 'Average',
            label: 'UI Service Memory',
          }),
        ],
        width: 8,
      })
    );

    // Application Load Balancer Metrics
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Load Balancer & Traffic',
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ALB - Request Count',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'RequestCount',
            dimensionsMap: {
              LoadBalancer: albName,
            },
            statistic: 'Sum',
            label: 'Total Requests',
          }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'ALB - Response Times',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'TargetResponseTime',
            dimensionsMap: {
              LoadBalancer: albName,
            },
            statistic: 'Average',
            label: 'Avg Response Time',
          }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'ALB - HTTP Status Codes',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_2XX_Count',
            dimensionsMap: {
              LoadBalancer: albName,
            },
            statistic: 'Sum',
            label: '2XX Success',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_4XX_Count',
            dimensionsMap: {
              LoadBalancer: albName,
            },
            statistic: 'Sum',
            label: '4XX Client Error',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_5XX_Count',
            dimensionsMap: {
              LoadBalancer: albName,
            },
            statistic: 'Sum',
            label: '5XX Server Error',
          }),
        ],
        width: 8,
      })
    );

    // CloudFront Metrics (if distribution exists)
    if (distributionId) {
      dashboard.addWidgets(
        new cloudwatch.TextWidget({
          markdown: '## CloudFront CDN',
          width: 24,
          height: 1,
        })
      );

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'CloudFront - Requests',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/CloudFront',
              metricName: 'Requests',
              dimensionsMap: {
                DistributionId: distributionId,
              },
              statistic: 'Sum',
              label: 'Total Requests',
            }),
          ],
          width: 8,
        }),
        new cloudwatch.GraphWidget({
          title: 'CloudFront - Cache Hit Rate',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/CloudFront',
              metricName: 'CacheHitRate',
              dimensionsMap: {
                DistributionId: distributionId,
              },
              statistic: 'Average',
              label: 'Cache Hit Rate %',
            }),
          ],
          width: 8,
        }),
        new cloudwatch.GraphWidget({
          title: 'CloudFront - Error Rate',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/CloudFront',
              metricName: 'ErrorRate',
              dimensionsMap: {
                DistributionId: distributionId,
              },
              statistic: 'Average',
              label: 'Error Rate %',
            }),
          ],
          width: 8,
        })
      );
    }

    // Bedrock Model Invocations
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Bedrock AI Models',
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Bedrock - Model Invocations',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'Invocations',
            dimensionsMap: {
              ModelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
            },
            statistic: 'Sum',
            label: 'Claude Sonnet 4',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'Invocations',
            dimensionsMap: {
              ModelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
            },
            statistic: 'Sum',
            label: 'Claude Sonnet 4.5',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'Invocations',
            dimensionsMap: {
              ModelId: 'us.amazon.nova-premier-v1:0',
            },
            statistic: 'Sum',
            label: 'Nova Premier',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'Invocations',
            dimensionsMap: {
              ModelId: 'us.amazon.nova-pro-v1:0',
            },
            statistic: 'Sum',
            label: 'Nova Pro',
          }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'Bedrock - Input Tokens',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'InputTokenCount',
            dimensionsMap: {
              ModelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
            },
            statistic: 'Sum',
            label: 'Claude Sonnet 4 Input',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'InputTokenCount',
            dimensionsMap: {
              ModelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
            },
            statistic: 'Sum',
            label: 'Claude Sonnet 4.5 Input',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'InputTokenCount',
            dimensionsMap: {
              ModelId: 'us.amazon.nova-premier-v1:0',
            },
            statistic: 'Sum',
            label: 'Nova Premier Input',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'InputTokenCount',
            dimensionsMap: {
              ModelId: 'us.amazon.nova-pro-v1:0',
            },
            statistic: 'Sum',
            label: 'Nova Pro Input',
          }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'Bedrock - Output Tokens',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'OutputTokenCount',
            dimensionsMap: {
              ModelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
            },
            statistic: 'Sum',
            label: 'Claude Sonnet 4 Output',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'OutputTokenCount',
            dimensionsMap: {
              ModelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
            },
            statistic: 'Sum',
            label: 'Claude Sonnet 4.5 Output',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'OutputTokenCount',
            dimensionsMap: {
              ModelId: 'us.amazon.nova-premier-v1:0',
            },
            statistic: 'Sum',
            label: 'Nova Premier Output',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'OutputTokenCount',
            dimensionsMap: {
              ModelId: 'us.amazon.nova-pro-v1:0',
            },
            statistic: 'Sum',
            label: 'Nova Pro Output',
          }),
        ],
        width: 8,
      })
    );

    // Knowledge Base Metrics
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Knowledge Base Usage',
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Knowledge Base - Retrievals',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'KnowledgeBaseRetrievals',
            statistic: 'Sum',
            label: 'Total Retrievals',
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Knowledge Base - Query Latency',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Bedrock',
            metricName: 'KnowledgeBaseQueryLatency',
            statistic: 'Average',
            label: 'Avg Query Latency',
          }),
        ],
        width: 12,
      })
    );

    // Application Logs
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Application Logs & Errors',
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'Recent Agent Service Errors',
        view: cloudwatch.LogQueryVisualizationType.TABLE,
        logGroupNames: [`/aws/ecs/containerinsights/${clusterName}/performance`],
        queryString: 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100',
        width: 12,
      }),
      new cloudwatch.LogQueryWidget({
        title: 'Recent UI Service Errors', 
        view: cloudwatch.LogQueryVisualizationType.TABLE,
        logGroupNames: [`/aws/ecs/containerinsights/${clusterName}/performance`],
        queryString: 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100',
        width: 12,
      })
    );
  }
}
