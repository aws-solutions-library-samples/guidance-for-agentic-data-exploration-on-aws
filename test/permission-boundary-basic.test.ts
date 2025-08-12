import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Template } from 'aws-cdk-lib/assertions';
import { PermissionBoundaryAspect } from '../lib/permission-boundary-aspect';

describe('PermissionBoundaryAspect', () => {
  test('applies permission boundary to IAM roles', () => {
    // ARRANGE
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    
    // Create a test permission boundary ARN
    const permissionBoundaryArn = 'arn:aws:iam::123456789012:policy/TestPermissionBoundary';
    
    // Create a test role
    new iam.Role(stack, 'TestRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    
    // ACT
    // Apply the permission boundary aspect to the stack
    cdk.Aspects.of(stack).add(new PermissionBoundaryAspect(stack, permissionBoundaryArn));
    
    // ASSERT
    // Check that the role has the permission boundary in the CloudFormation template
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::IAM::Role', {
      PermissionsBoundary: permissionBoundaryArn
    });
  });
  
  test('preserves existing permission boundaries', () => {
    // ARRANGE
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    
    // Create test permission boundary ARNs
    const existingBoundaryArn = 'arn:aws:iam::123456789012:policy/ExistingBoundary';
    const newBoundaryArn = 'arn:aws:iam::123456789012:policy/NewBoundary';
    
    // Create a role with an existing permission boundary
    const existingBoundaryPolicy = iam.ManagedPolicy.fromManagedPolicyArn(
      stack, 
      'ExistingBoundary', 
      existingBoundaryArn
    );
    
    new iam.Role(stack, 'RoleWithBoundary', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      permissionsBoundary: existingBoundaryPolicy
    });
    
    // Create a role without a boundary
    new iam.Role(stack, 'RoleWithoutBoundary', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });
    
    // ACT
    // Apply the permission boundary aspect to the stack
    cdk.Aspects.of(stack).add(new PermissionBoundaryAspect(stack, newBoundaryArn));
    
    // ASSERT
    const template = Template.fromStack(stack);
    
    // Check that the role with an existing boundary keeps it
    template.hasResourceProperties('AWS::IAM::Role', {
      PermissionsBoundary: existingBoundaryArn,
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com'
            }
          }
        ]
      }
    });
    
    // Check that the role without a boundary gets the new one
    template.hasResourceProperties('AWS::IAM::Role', {
      PermissionsBoundary: newBoundaryArn,
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'ec2.amazonaws.com'
            }
          }
        ]
      }
    });
  });
});
