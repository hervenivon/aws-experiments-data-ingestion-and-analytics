import * as fs from 'fs';
import * as path from 'path';
import cdk = require('@aws-cdk/core');
import iam = require('@aws-cdk/aws-iam');
import firehose = require('@aws-cdk/aws-kinesisfirehose');
import analytics = require('@aws-cdk/aws-kinesisanalytics');
import lambda = require('@aws-cdk/aws-lambda');
import logs = require('@aws-cdk/aws-logs');
import { Asset as S3Asset } from '@aws-cdk/aws-s3-assets';

function generateRecordColumns(): Array<analytics.CfnApplication.RecordColumnProperty> {
  const a: analytics.CfnApplicationV2.RecordColumnProperty[] = [];

  // C0 (Integer) - Indicates if an ad was clicked (1) or not (0).
  a.push({name: 'AD', sqlType: 'INTEGER'});

  // C1-C13 - 13 columns of integer features mostly representing count features.
  for (let i = 1; i <= 13; i++) {
    a.push({name: `COUNTF${i}`, sqlType: 'INTEGER'})
  }

  // C14-C39 - 26 columns of categorical features. The values of these features have been hashed onto 32 bits for anonymization purposes.
  for (let i = 1; i <= 26; i++) {
    a.push({name: `CATF${i}`, sqlType: 'VARCHAR(8)'})
  }

  return a;
}

export interface EnhancementProps {
  assetBasePath: string,
  inputStream: firehose.CfnDeliveryStream
}

export class Enhancement extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: EnhancementProps) {
    super(scope, id);

    const referentialData = new S3Asset(this, 'ReferentialData', {
      path: path.join(props.assetBasePath, 'data', 'referential.tsv')
    });

    // Create a role for Kinesis Data Analytics
    const role = new iam.Role(this, 'KinesisAnalyticsRole', {
      assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com')
    });

    // Grant the Kinesis Data Analytics role to read the inputStream from the ingestion layer
    const readInputStreamPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'firehose:DescribeDeliveryStream',
        'firehose:Get*',
      ],
      resources: [
        props.inputStream.attrArn
      ]
    });
    role.addToPolicy(readInputStreamPolicyStatement);

    // Grant the Kinesis Data Analytics role access to new uploaded assets
    referentialData.grantRead(role);

    // Create a lambda for destination of the application
    const lambdaEnv = {};
    const outputStream2Metrics = new lambda.Function(this, 'OutputStream2Metrics', {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.asset(path.join(props.assetBasePath, 'enhancement-metrics')),
      handler: 'main.handler',
      environment: lambdaEnv,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });
    // Grant the kinesis role to execute the lambda
    outputStream2Metrics.grantInvoke(role);
    // Grant the lambda to write CloudWatch metrics
    outputStream2Metrics.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
      ],
      resources: [
        '*'
      ]
    }));

    const applicationName = 'EnhancementSQLApplication';
    const sqlStatement = fs.readFileSync(path.join(props.assetBasePath, 'enhancement', 'enhancement.sql'), 'utf8');
    const sqlApplication = new analytics.CfnApplication(this, 'Enhancement/SQLApplication', {
      applicationName,
      applicationDescription: 'Count successful and unsuccessful bidrequests and call AWS lambda to push those metrics to AWS CloudWatch',
      inputs: [{
        inputSchema: {
          recordEncoding: 'UTF-8',
          recordFormat: {
            recordFormatType: 'CSV',
            mappingParameters: {
              csvMappingParameters: {
                recordColumnDelimiter: '\t',
                recordRowDelimiter: '\n',
              }
            }
          },
          recordColumns: generateRecordColumns(),
        },
        namePrefix: 'input_stream',
        kinesisFirehoseInput: {
          resourceArn: props.inputStream.attrArn,
          roleArn: role.roleArn,
        }
      }],
      applicationCode: sqlStatement,
    });

    // Connecting a S3 reference file to the SQL Application
    const sqlApplicationReference = new analytics.CfnApplicationReferenceDataSource(this, 'Enhancement/SQLApplicationRefDataSource', {
      applicationName,
      referenceDataSource: {
        referenceSchema: {
          recordColumns: [
            {name: 'CODE', sqlType: 'INTEGER'},
            {name: 'REFERENCE', sqlType: 'VARCHAR(12)'}
          ],
          recordFormat: {
            recordFormatType: 'CSV',
            mappingParameters: {
              csvMappingParameters: {
                recordColumnDelimiter: '\t',
                recordRowDelimiter: '\n',
              }
            }
          },
          recordEncoding: 'UTF-8'
        },
        s3ReferenceDataSource: {
          bucketArn: referentialData.bucket.bucketArn,
          fileKey: referentialData.s3ObjectKey,
          referenceRoleArn: role.roleArn,
        },
        tableName: 'referential'
      }
    });
    sqlApplicationReference.node.addDependency(sqlApplication);

    // Connection a lambda as a destination to the SQL Application
    const sqlApplicationOutput = new analytics.CfnApplicationOutput(this, 'Enhancement/SQLApplicationOutput', {
      applicationName,
      output: {
        destinationSchema: {
          recordFormatType: 'JSON'
        },
        name: 'count_stream',
        lambdaOutput: {
          resourceArn: outputStream2Metrics.functionArn,
          roleArn: role.roleArn
        }
      }
    });
    sqlApplicationOutput.node.addDependency(sqlApplication);
    sqlApplicationOutput.node.addDependency(outputStream2Metrics);
  }
}