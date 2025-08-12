import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Template } from 'aws-cdk-lib/assertions';
import { NeptuneBaseStack } from '../lib/neptune-base-stack';
describe('VPC Subnet Selection Context Tests', () => {
  let app: cdk.App;
  
  beforeEach(() => {
    app = new cdk.App();
  });

  test('Creates new VPC when no context is provided', () => {
    const stack = new NeptuneBaseStack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      },
      environment: 'test',
      dbInstanceType: 'db.serverless',
      minNcus: 2.5,
      maxNcus: 128,
      dbClusterPort: '8182',
      neptuneQueryTimeout: 120000,
      neptuneEnableAuditLog: 0,
      iamAuthEnabled: false,
      backupRetention: 7,
      attachBulkloadIamRole: true,
      storageEncrypted: true,
      preserveDataBuckets: false,
    });

    const template = Template.fromStack(stack);
    
    // Should create a new VPC
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '172.30.0.0/16'
    });
  });

  test('Uses existing VPC when vpcid context is provided', () => {
    // Set context for existing VPC with proper mocking
    const appWithContext = new cdk.App({
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
    
    const stack = new NeptuneBaseStack(appWithContext, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      },
      environment: 'test',
      dbInstanceType: 'db.serverless',
      minNcus: 2.5,
      maxNcus: 128,
      dbClusterPort: '8182',
      neptuneQueryTimeout: 120000,
      neptuneEnableAuditLog: 0,
      iamAuthEnabled: false,
      backupRetention: 7,
      attachBulkloadIamRole: true,
      storageEncrypted: true,
      preserveDataBuckets: false,
    });

    const template = Template.fromStack(stack);
    
    // Should NOT create a new VPC
    template.resourceCountIs('AWS::EC2::VPC', 0);
  });

  test('Handles dbSubnetIds context parameter', () => {
    // Set context for existing VPC and specific subnet IDs
    const appWithContext = new cdk.App({
      context: {
        vpcid: 'vpc-12345678',
        dbSubnetIds: 'subnet-12345678,subnet-87654321',
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
    
    // Create a separate stack for this test to avoid ID conflicts
    const stack = new NeptuneBaseStack(appWithContext, 'TestStackSubnetIds', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      },
      environment: 'test',
      dbInstanceType: 'db.serverless',
      minNcus: 2.5,
      maxNcus: 128,
      dbClusterPort: '8182',
      neptuneQueryTimeout: 120000,
      neptuneEnableAuditLog: 0,
      iamAuthEnabled: false,
      backupRetention: 7,
      attachBulkloadIamRole: true,
      storageEncrypted: true,
      preserveDataBuckets: false,
    });

    const template = Template.fromStack(stack);
    
    // Should create Neptune DB subnet group with the specified subnet IDs
    template.hasResourceProperties('AWS::Neptune::DBSubnetGroup', {
      DBSubnetGroupName: 'PanopticNeptuneSubnetGroup',
      DBSubnetGroupDescription: 'Neptune DB subnet group',
      SubnetIds: ['subnet-12345678', 'subnet-87654321']
    });
  });

  test('Creates VPC endpoints only for new VPC', () => {
    const stack = new NeptuneBaseStack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      },
      environment: 'test',
      dbInstanceType: 'db.serverless',
      minNcus: 2.5,
      maxNcus: 128,
      dbClusterPort: '8182',
      neptuneQueryTimeout: 120000,
      neptuneEnableAuditLog: 0,
      iamAuthEnabled: false,
      backupRetention: 7,
      attachBulkloadIamRole: true,
      storageEncrypted: true,
      preserveDataBuckets: false,
    });

    const template = Template.fromStack(stack);
    
    // Should create VPC endpoints for new VPC (check for the actual service name format)
    template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      ServiceName: 'com.amazonaws.us-east-1.bedrock-runtime'
    });
  });

  test('Does not create VPC endpoints for existing VPC', () => {
    // Set context for existing VPC
    const appWithContext = new cdk.App({
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
    
    const stack = new NeptuneBaseStack(appWithContext, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      },
      environment: 'test',
      dbInstanceType: 'db.serverless',
      minNcus: 2.5,
      maxNcus: 128,
      dbClusterPort: '8182',
      neptuneQueryTimeout: 120000,
      neptuneEnableAuditLog: 0,
      iamAuthEnabled: false,
      backupRetention: 7,
      attachBulkloadIamRole: true,
      storageEncrypted: true,
      preserveDataBuckets: false,
    });

    const template = Template.fromStack(stack);
    
    // Should NOT create VPC endpoints for existing VPC
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 0);
  });
});
