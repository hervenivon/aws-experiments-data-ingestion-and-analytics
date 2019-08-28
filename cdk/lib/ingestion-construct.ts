import * as path from 'path';
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import events = require('@aws-cdk/aws-events');
import iam = require('@aws-cdk/aws-iam');
import firehose = require('@aws-cdk/aws-kinesisfirehose');
import { Bucket } from '@aws-cdk/aws-s3';
import { EcsTask } from '@aws-cdk/aws-events-targets';
import { Asset as S3Asset } from '@aws-cdk/aws-s3-assets';

export interface IngestionProps {
  bucket: Bucket
}

export class Ingestion extends cdk.Construct {
  public readonly bucket: Bucket;

  constructor(scope: cdk.Construct, id: string, props: IngestionProps) {
    super(scope, id);

    const role = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    props.bucket.grantReadWrite(role);

    // Props details: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-kinesisfirehose-deliverystream-extendeds3destinationconfiguration.html
    const ingestionLayer = new firehose.CfnDeliveryStream(this, 'FirehoseDeliveryStream', {
      deliveryStreamName: 'BidRequestExperimentIngestionLayer',
      deliveryStreamType: 'DirectPut',
      extendedS3DestinationConfiguration: {
        bucketArn: props.bucket.bucketArn,
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 128
        },
        roleArn: role.roleArn,
        prefix: 'raw-data/',
        compressionFormat: 'UNCOMPRESSED',
        s3BackupMode: 'Disabled'
      }
    });

    this.bucket = props.bucket;
  }
}
