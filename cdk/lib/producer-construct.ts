import * as path from 'path';
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import events = require('@aws-cdk/aws-events');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import logs = require('@aws-cdk/aws-logs');
import { EcsTask } from '@aws-cdk/aws-events-targets';
import { Asset as S3Asset } from '@aws-cdk/aws-s3-assets';

export interface ProducerProps {
  assetBasePath: string,
  streamName: string,
  streamArn: string,
}

export class Producer extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ProducerProps) {
    super(scope, id);

    // Assets to upload
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-s3-assets-readme.html
    const bidrequestsData = new S3Asset(this, 'BidRequestsData', {
      path: path.join(props.assetBasePath, 'data', 'bidrequests.txt')
    });

    // Producer definition, launch is done through a lambda function
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2, // Default is all AZs in the region
    });

    const cluster = new ecs.Cluster(this, 'Ec2Cluster', {
      vpc: vpc
    });

    const logging = new ecs.AwsLogDriver({
      streamPrefix: 'BidRequestsExperiment',
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ProducerTaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256,
    })

    taskDefinition.addContainer('AppContainer', {
      image: ecs.ContainerImage.fromAsset(path.join(props.assetBasePath, 'producer')),
      logging,
      environment: { // clear text, not for sensitive data
        'S3_BUCKET_NAME': bidrequestsData.s3BucketName,
        'S3_OBJECT_KEY': bidrequestsData.s3ObjectKey,
        'STREAM_NAME': props.streamName,
      },
    });
    // Grant task access to new uploaded assets
    bidrequestsData.grantRead(taskDefinition.taskRole);

    // Grant task access to perform PutRecord
    const putRecordPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'firehose:PutRecord',
      ],
      resources: [
        props.streamArn
      ]
    });
    taskDefinition.taskRole.addToPolicy(putRecordPolicyStatement);


    // Create a command line launcher for the fargate task. It is based on lambda.
    const lambdaEnv = {
      CLUSTER_NAME: cluster.clusterName,
      TASK_DEFINITION: taskDefinition.taskDefinitionArn,
      SUBNETS: JSON.stringify(Array.from(vpc.privateSubnets, x => x.subnetId)),
    };

    const runTaskPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecs:RunTask',
      ],
      resources: [
        //cdk.Fn.getAtt(taskDefinition.node.uniqueId, 'Arn').toString(),
        taskDefinition.taskDefinitionArn,
      ]
    });

    const taskExecutionRolePolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:PassRole',
      ],
      resources: [
        taskDefinition.obtainExecutionRole().roleArn,
        taskDefinition.taskRole.roleArn,
      ]
    });

    const producerLauncher = new lambda.Function(this, 'ProducerLauncher', {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.asset(path.join(props.assetBasePath, 'producer-launcher')),
      handler: 'run_task.handler',
      environment: lambdaEnv,
    });
    producerLauncher.addToRolePolicy(runTaskPolicyStatement);
    producerLauncher.addToRolePolicy(taskExecutionRolePolicyStatement);

    const baseCommand = `aws lambda invoke --function-name ${producerLauncher.functionArn} --payload '{}' /tmp/out --log-type Tail --query 'LogResult' --output text`;

    new cdk.CfnOutput(this, 'launchProducerOnMacOS', {
      exportName: 'launchProducerOnMacOS',
      value: baseCommand + ' | base64 -D'
    });

    new cdk.CfnOutput(this, 'launchProducerOnLinux', {
      exportName: 'launchProducerOnLinux',
      value: baseCommand + ' | base64 -d'
    });
  }
}
