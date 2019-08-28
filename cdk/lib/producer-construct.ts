import * as path from 'path';
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import events = require('@aws-cdk/aws-events');
import { EcsTask } from '@aws-cdk/aws-events-targets';
import { Asset as S3Asset } from '@aws-cdk/aws-s3-assets';

export interface ProducerProps {
  assetBasePath: string,
}

export class Producer extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ProducerProps) {
    super(scope, id);

    // Assets to upload
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-s3-assets-readme.html
    const bidrequestsData = new S3Asset(this, 'BidRequestsData', {
      path: path.join(props.assetBasePath, 'data', 'bidrequests.txt')
    });

    // Producer definition, launch is manual
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2, // Default is all AZs in the region
    });
    const cluster = new ecs.Cluster(this, 'Ec2Cluster', {
      vpc: vpc
    });
    const logging = new ecs.AwsLogDriver({
      streamPrefix: 'BidRequestsExperiment'
    });
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ProducerTaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256,
    })
    taskDefinition.addContainer('AppContainer', {
      image: ecs.ContainerImage.fromAsset(path.join(props.assetBasePath, 'producer')),
      logging,
      environment: { // clear text, not for sensitive data
        S3URLBIDREQUESTSDATA: bidrequestsData.s3Url,
      },
    });
    // Grant task access to new uploaded assets
    bidrequestsData.grantRead(taskDefinition.taskRole);

    // End of producer service

    // cf https://github.com/aws/aws-cdk/blob/56656e0a6e2ded466df21f3dff9bfae0afe5c4de/packages/%40aws-cdk/aws-ecs-patterns/test/ec2/test.scheduled-ecs-task.ts
    // and https://github.com/aws/aws-cdk/blob/v1.6.0/packages/@aws-cdk/aws-ecs-patterns/lib/fargate/scheduled-fargate-task.ts#L38
    // for an implementation of the following
    // new ecs_patterns.ScheduledFargateTask(this, 'ScheduledTask', {
    //   cluster,
    //   image: ecs.ContainerImage.fromAsset(path.join(basePath, 'producer')),
    //   schedule: events.Schedule.expression('cron(0 0 1 1 ? 1970)'), // https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html
    //   memoryLimitMiB: 256,
    //   logDriver:
    // });
  }
}
