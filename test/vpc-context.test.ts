import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NeptuneBaseStack } from '../lib/neptune-base-stack';

describe('VPC Context Tests', () => {
  test('Creates new VPC when no context provided', () => {
    const app = new cdk.App();
    const stack = new NeptuneBaseStack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      },
      dbClusterId: 'test-cluster',
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
    });

    const template = Template.fromStack(stack);
    
    // Should create a new VPC
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '172.30.0.0/16'
    });
    
    // Should create VPC Flow Logs
    template.hasResourceProperties('AWS::EC2::FlowLog', {
      ResourceType: 'VPC'
    });
    
    // Should create VPC Endpoints (check for any bedrock endpoint)
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 5);
  });

  test('Uses existing VPC when context provided', () => {
    const app = new cdk.App({
      context: {
        vpcid: 'vpc-12345678',
        // Mock the VPC lookup to avoid actual AWS calls
        'vpc-provider:account=123456789012:filter.vpc-id=vpc-12345678:region=us-east-1:returnAsymmetricSubnets=true': {
          vpcId: 'vpc-12345678',
          vpcCidrBlock: '10.0.0.0/16',
          availabilityZones: ['us-east-1a', 'us-east-1b'],
          subnetGroups: [
            {
              name: 'Private',
              type: 'Private',
              subnets: [
                {
                  subnetId: 'subnet-12345678',
                  cidr: '10.0.1.0/24',
                  availabilityZone: 'us-east-1a',
                  routeTableId: 'rtb-12345678'
                },
                {
                  subnetId: 'subnet-87654321',
                  cidr: '10.0.2.0/24',
                  availabilityZone: 'us-east-1b',
                  routeTableId: 'rtb-87654321'
                }
              ]
            }
          ]
        }
      }
    });
    
    const stack = new NeptuneBaseStack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      },
      dbClusterId: 'test-cluster',
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
    });

    const template = Template.fromStack(stack);
    
    // Should NOT create a new VPC
    template.resourceCountIs('AWS::EC2::VPC', 0);
    
    // Should NOT create VPC Flow Logs
    template.resourceCountIs('AWS::EC2::FlowLog', 0);
    
    // Should NOT create VPC Endpoints (to avoid conflicts)
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 0);
    
    // Should still create Neptune resources
    template.hasResourceProperties('AWS::Neptune::DBCluster', {
      DBClusterIdentifier: 'test-cluster'
    });
  });
});
