import * as path from 'path';
import cdk = require('@aws-cdk/core');
import iam = require('@aws-cdk/aws-iam');
import firehose = require('@aws-cdk/aws-kinesisfirehose');
import analytics = require('@aws-cdk/aws-kinesisanalytics');
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

    const role = new iam.Role(this, 'KinesisAnalyticsRole', {
      assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com')
    });

    const logGroup = new logs.LogGroup(this, 'KinesisAnalyticsLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK
    });

    // Grant Kinesis Data Analytics to Read inputStream
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
    // Grant task access to new uploaded assets
    referentialData.grantRead(role);

    const applicationName = 'EnhancementSQLApplication';
    const sqlStatement = `
CREATE OR REPLACE STREAM "enhanced_stream" (INGEST_TIME TIMESTAMP, AD VARCHAR(12));

CREATE OR REPLACE PUMP "enhanced_stream_pump" AS INSERT INTO "enhanced_stream"
      SELECT STREAM APPROXIMATE_ARRIVAL_TIME, "r"."REFERENCE" as "AD"
      FROM "input_stream_001" LEFT JOIN "referential" as "r"
      ON "input_stream_001"."AD" = "r"."CODE";

CREATE OR REPLACE STREAM "count_stream" (AD VARCHAR(12), NBR INTEGER);

CREATE OR REPLACE PUMP "count_stream_pump" AS INSERT INTO "count_stream"
    SELECT STREAM AD, COUNT(AD)
        FROM "enhanced_stream"
        GROUP BY AD,
            STEP("enhanced_stream".ROWTIME BY INTERVAL '30' SECOND);
`;
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
  }
}