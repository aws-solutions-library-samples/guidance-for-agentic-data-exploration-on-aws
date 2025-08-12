import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Aspects, IAspect } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

/**
 * CDK Aspect that applies a permission boundary to all IAM roles in the application.
 * This provides a centralized way to enforce permission boundaries across all stacks.
 */
export class PermissionBoundaryAspect implements IAspect {
  private readonly permissionBoundaryArn: string;
  private readonly scope: cdk.Stack;
  private appliedToRoles: Set<string> = new Set();

  constructor(scope: cdk.Stack, permissionBoundaryArn: string) {
    this.scope = scope;
    this.permissionBoundaryArn = permissionBoundaryArn;
  }

  public visit(node: IConstruct): void {
    // Apply permission boundary to all IAM roles
    if (node instanceof iam.Role) {
      const role = node as iam.Role;
      
      // Generate a unique ID for the role to avoid duplicate boundary attachments
      const roleId = role.node.path;
      
      // Skip if we've already processed this role
      if (this.appliedToRoles.has(roleId)) {
        return;
      }
      
      try {
        // Get the CloudFormation role resource
        const cfnRole = role.node.defaultChild as iam.CfnRole;
        
        // Skip if the role already has a permission boundary
        if (cfnRole.permissionsBoundary) {
          return;
        }
        
        // Set the permission boundary
        cfnRole.permissionsBoundary = this.permissionBoundaryArn;
        
        // Mark this role as processed
        this.appliedToRoles.add(roleId);
      } catch (error) {
        // Log any errors but don't fail the deployment
        console.error(`Failed to apply permission boundary to role ${role.node.id}: ${error}`);
      }
    }
  }
}
