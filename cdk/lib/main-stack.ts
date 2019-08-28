import * as path from 'path';
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import events = require('@aws-cdk/aws-events');
import s3 = require('@aws-cdk/aws-s3');
import { EcsTask } from '@aws-cdk/aws-events-targets';
import { Asset as S3Asset } from '@aws-cdk/aws-s3-assets';

import { Producer } from './producer-construct';
import { Ingestion } from './ingestion-construct';

export class MainStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const basePath = path.join(__dirname, '..', '..');

    // Data Lake for Bidrequest store
    const rawBucket = new s3.Bucket(this, 'BidRequestExperimentStorage', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED
    });

    // Creation of the Ingestion layer
    const ingestion = new Ingestion(this, 'IngestionLayer', {
      bucket: rawBucket
    })

    // Creation of the Fargate producer layer
    const producer = new Producer(this, 'ProducerLayer', {
      assetBasePath: basePath,
      streamName: ingestion.streamName,
      streamArn: ingestion.streamArn
    });
    producer.node.addDependency(ingestion);

    new cdk.CfnOutput(this, 'rawBucket', {
      exportName: 'rawBucket',
      value: rawBucket.bucketName,
    });
  }
}
