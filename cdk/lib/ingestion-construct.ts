import * as path from 'path';
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import events = require('@aws-cdk/aws-events');
import iam = require('@aws-cdk/aws-iam');
import firehose = require('@aws-cdk/aws-kinesisfirehose');
import { Bucket } from '@aws-cdk/aws-s3';

export interface IngestionProps {
  bucket: Bucket
}

export class Ingestion extends cdk.Construct {
  public readonly ingestionStream: firehose.CfnDeliveryStream;

  constructor(scope: cdk.Construct, id: string, props: IngestionProps) {
    super(scope, id);

    const role = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    props.bucket.grantReadWrite(role);

    // Props details: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-kinesisfirehose-deliverystream-extendeds3destinationconfiguration.html
    const deliveryStreamName = 'BidRequestExperimentIngestionLayer';
    this.ingestionStream = new firehose.CfnDeliveryStream(this, 'FirehoseDeliveryStream', {
      deliveryStreamName,
      deliveryStreamType: 'DirectPut',
      extendedS3DestinationConfiguration: {
        bucketArn: props.bucket.bucketArn,
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 128
        },
        roleArn: role.roleArn,
        prefix: 'raw-data/',
        compressionFormat: 'GZIP',
        s3BackupMode: 'Disabled'
      }
    });
    if (!this.ingestionStream .deliveryStreamName){
      this.ingestionStream.deliveryStreamName = deliveryStreamName;
    }
  }
}
