
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

interface UserStorageStackProps extends cdk.StackProps {
  accessLogsBucket: s3.Bucket
}

export class UserStorageStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: UserStorageStackProps) {
    super(scope, id, props);

    const userBucket = new s3.Bucket(this, "PanopticUserDataBucket", {
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
        },
      ],
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'userStorageLogs/',           
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicPolicy: true,
        blockPublicAcls: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    new ssm.StringParameter(this, 'UserBucketNameParameter', {
      parameterName: '/panoptic/user-bucket-name',
      stringValue: userBucket.bucketName
    });
  }
}