import cdk = require('@aws-cdk/core');
import cw = require('@aws-cdk/aws-cloudwatch');
import { GraphWidget } from '@aws-cdk/aws-cloudwatch';
import { CfnMaintenanceWindow } from '@aws-cdk/aws-ssm';

export interface VisualizationProps {
  kinesisApplicationName: string,
  rawBucketURI: string
}

export class Visualization extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: VisualizationProps) {
    super(scope, id);

    const failMetric = new cw.Metric({
      namespace: 'BidRequestExperiment',
      metricName: 'Not clicked',
      color: '#ff7f0e',
      period: cdk.Duration.seconds(60),
      statistic: 'Sum',
    });
    const successMetric = new cw.Metric({
      namespace: 'BidRequestExperiment',
      metricName: 'Clicked',
      color: '#2ca02c',
      period: cdk.Duration.seconds(60),
      statistic: 'Sum',
    });

    const bidRequestMetric = new cw.Metric({
      namespace: 'AWS/KinesisAnalytics',
      metricName: 'Records',
      dimensions: {
        'Id': '1.1',
        'Application': props.kinesisApplicationName,
        'Flow': 'Input'
      },
      color: '#9467bd',
      period: cdk.Duration.hours(1),
      statistic: 'Sum'
    });

    const outputsMetric = new cw.Metric({
      namespace: 'AWS/KinesisAnalytics',
      metricName: 'Records',
      dimensions: {
        'Id': '8.1',
        'Application': props.kinesisApplicationName,
        'Flow': 'Output'
      },
      color: '#17becf',
      period: cdk.Duration.hours(1),
      statistic: 'Sum'
    });

    // The widgets on a dashboard are visually laid out in a grid that is 24 columns wide
    const dashboard = new cw.Dashboard(this, 'RealTimeDashboard', {
      dashboardName: 'BidRequestRealTimeDashboard'
    });

    const graphWidget = new cw.GraphWidget({
      title: 'Nbr of Bid requests per minutes',
      left: [
        failMetric,
        successMetric
      ],
      leftYAxis: {
        label: 'Bid requests',
        showUnits: false
      },
      stacked: true,
      width: 12,
      height: 6
    });
    const statsWidget = new cw.SingleValueWidget({
      title: 'Statistics over the last hour (Kinesis Analytics Application)',
      metrics: [
        bidRequestMetric.with({
          label: 'Bid Requests'
        }),
        outputsMetric.with({
          label: 'Metrics points'
        })
      ],
      width: 9,
      height: 3,
    });
    statsWidget.position(13, 0);

    dashboard.addWidgets(graphWidget);
    dashboard.addWidgets(statsWidget);


    const quicksightManifestFileDataSource = {
      fileLocations: [{
        URIPrefixes: [props.rawBucketURI + '/raw-data/YYYY/MM/DD/']
      }],
      globalUploadSettings: {
        format: 'TSV',
        delimiter: '\t',
        containsHeader: false
      }
    }

    new cdk.CfnOutput(this, 'QuickSightManifestFile', {
      exportName: 'QuickSightManifestFile',
      value: JSON.stringify(quicksightManifestFileDataSource),
    });
  }
}