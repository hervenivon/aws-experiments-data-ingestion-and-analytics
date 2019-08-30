# aws-experiments-data-ingestion-and-analytics

This experiment simulates data ingestion of bid requests to a serverless data lake and data analytics pipeline deployed on AWS.

Services in use:

- [AWS Fargate](https://aws.amazon.com/fargate/) for simulating bid requests,
- [Amazon Kinesis Data Firehose](https://aws.amazon.com/kinesis/data-firehose/) for data ingestion,
- [Amazon Kinesis Data Analytics](https://aws.amazon.com/kinesis/data-analytics/) for data enhancement,
- [Amazon S3](https://aws.amazon.com/s3/) for data storage,
- [AWS Lambda](https://aws.amazon.com/lambda/) for publishing near real time measures,
- [Amazon QuickSight](https://aws.amazon.com/quicksight/) for data visualization,
- [Amazon CloudWatch](https://aws.amazon.com/cloudwatch/) for near realtime data visualization.

[Data used](https://s3-eu-west-1.amazonaws.com/kaggle-display-advertising-challenge-dataset/dac.tar.gz) for this experiment are coming from the [Kaggle Display Advertising Challenge Dataset](https://labs.criteo.com/2014/02/download-kaggle-display-advertising-challenge-dataset/) published in 2014 by [Criteo](https://www.kaggle.com/c/criteo-display-ad-challenge/data). If you are curious or if you want to push the Criteo Dataset further, you can refer to their 2015 [announcement](https://labs.criteo.com/2015/03/criteo-releases-its-new-dataset/) and the related [download](https://labs.criteo.com/2013/12/download-terabyte-click-logs-2/).

Every time it is possible, this experiment leverages [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html) to deploy the required infrastructure.

## Table of content

- [Architecture overview](#architecture-overview)
- [Pre requisites](#pre-requisites)
- [Deploy](#deploy)
  - [Download necessary Data](#download-necessary-data)
  - [Build the CDK application](#build-the-cdk-application)
  - [Deploy the stack and upload the data](#deploy-the-stack-and-upload-the-data)
  - [Deploy Amazon QuickSight](#deploy-amazon-quicksight)
- [Results](#results)
- [Cost](#cost)
- [Solutions alternatives](#solutions-alternatives)
- [Develop](#develop)
- [Cleanup](#cleanup)
- [Inspiring source of information](#inspiring-source-of-information)

## Architecture overview

1. Producer: AWS Fargate push data from the CSV file to Amazon Kinesis Data Firehose
2. Ingestion: Amazon Kinesis Data Firehose ingests the data
3. Enhancement: Amazon Kinesis Data Analytics:
    - enhances the data with catalog stored in Amazon s3
    - triggers a AWS Lambda function to store real time measures in Amazon CloudWatch
4. Visualization:
    - Amazon CloudWatch allows visualization of custom near real-time metrics
    - Amazon Quick Sights allows reporting on enhanced data stored in Amazon S3

## Pre requisites

For this experiment you will need the following:

- The [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
- An AWS account. If you don’t have an AWS account, you can create a free account [here](https://portal.aws.amazon.com/billing/signup/iam).
- Node.js (>= 8.10). To install Node.js visit the [node.js](https://nodejs.org/en/) website. You can also a node version manager: [nvm](https://github.com/nvm-sh/nvm)
- The [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) toolkit: `$> npm install -g aws-cdk`

If this is the first time you deploy a CDK application in an AWS environment, you need to bootstrap it: `cdk bootstrap`. Please take a look at the bootstrap section of the [CDK workshop](https://cdkworkshop.com/20-typescript/20-create-project/500-deploy.html).

## Deploy

The deployment is a 4 steps process:

1. Download necessary data
2. Build the CDK application
3. Deploy the stack and upload the data
4. Deploy Amazon QuickSight

### Download necessary Data

Download the [data](https://s3-eu-west-1.amazonaws.com/kaggle-display-advertising-challenge-dataset/dac.tar.gz), extract it to the `data` directory.

*Important*: we don't want to upload the whole dataset, therefore we are taking a small amount of it with the following command in the `data` directory:

```bash
$> head -5000000 train.txt > bidrequests.txt
```

*Data fields*:

- C0 (Integer) - Indicates if an ad was clicked (1) or not (0).
- C1-C13 - 13 columns of integer features mostly representing count features.
- C14-C39 - 26 columns of categorical features. The values of these features have been hashed onto 32 bits for anonymization purposes.

### Build the CDK application

At the root of the repository:

```bash
$> npm install
```

This will install all the AWS CDK project dependencies.

```bash
$> npm run build
```

This command will build the CDK application: compile Typescript code into Javascript.

### Deploy the stack and upload the data

### Deploy Amazon QuickSight

## Exploring the demo

Before starting the exploration of the demo, let's launch the producer. This will populate the demonstration with data.

### Launch the producer

If you encounter the following error `"Unable to assume the service linked role. Please verify that the ECS service linked role exists."` while launching the producer, please follow instructions [here](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using-service-linked-roles.html#create-service-linked-role) and create the linked service role:

```bash
$> aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com
```

### What has been deployed

#### Kinesis Data analytics

[In-application Streams and Pumps](https://docs.aws.amazon.com/kinesisanalytics/latest/dev/streams-pumps.html)

### Results

## Cost

## Solutions alternatives

## Develop

Since this CDK project is typescript based, sources need to be compiled to JavaScript every time you make a modification to source files. This project is configured with a nice little npm script called `watch` that automatically compile `.js` file every time you make a change

### Start watching for changes

In the home directory, open a new terminal and enter:

```bash
$> npm run watch
```

### Useful commands

- `npm run build`   compile typescript to js
- `npm run watch`   watch for changes as you edit the application and compile
- `cdk deploy`      deploy this stack to your default AWS account/region
- `cdk diff`        compare deployed stack with current state
- `cdk synth`       emits the synthesized CloudFormation template
- `cdk destroy`     destroy the CDK application in your default AWS account/region

Note: a `cdk diff` command might take up to the minute. The main reason here is that the CDK command perform a hash of a very big file (`train.txt`) that we are uploading as an asset of the application.

## Clean up

Destroy the CDK application:

```bash
$> cdk destroy
```

## Inspiring source of information

1. Producer:
    - [Data](https://s3-eu-west-1.amazonaws.com/kaggle-display-advertising-challenge-dataset/dac.tar.gz)
    - [Pushing csv to Kinesis firehose](https://github.com/cetic/push2firehose)
    - [Uploading data to s3](https://docs.aws.amazon.com/cdk/latest/guide/assets.html) leveraging the Amazon S3 assets type
    - [Creating an AWS Fargate Service Using the AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/ecs_example.html)
    - [aws-ecs-patterns](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecs-patterns-readme.html) CDK module
    - [fargate-service-with-logging](https://github.com/aws-samples/aws-cdk-examples/blob/master/typescript/ecs/fargate-service-with-logging/index.ts)
    - [Building docker image with CDK](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecr-assets-readme.html)
    - [ecs-demo Dockerfile](https://github.com/aws-samples/ecs-demo-php-simple-app/blob/master/Dockerfile)
    - [Deploy Go Applications to ECS using AWS CDK](https://medium.com/tysonworks/deploy-go-applications-to-ecs-using-aws-cdk-1a97d85bb4cb) and its [repository](https://github.com/TysonWorks/cdk-examples/tree/master/typescript/ecs-go-api)
2. Ingestion:
    - [Creating a kinesis firehose with CDK](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-kinesisfirehose.CfnDeliveryStream.html) + supportive [CloudFormation documentation](https://github.com/awsdocs/aws-cloudformation-user-guide/blob/master/doc_source/aws-resource-kinesisfirehose-deliverystream.md)
3. Enhancement:
    - [Creating a kinesis data analytics application with CDK](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-kinesisanalytics-readme.html) + supportive [CloudFormation documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-kinesisanalyticsv2-application.html)
    - Uploading reference file to S3
    - Send results to S3
    - Enhance data in one way or the other 😅
    - Connect a lambda function to publish metrics to lambda start [here](https://github.com/aws-samples/realtime-web-analytics-workshop/blob/master/module-2/README.md) and [here](https://github.com/aws-samples/realtime-web-analytics-workshop/blob/master/module-3/README.md)
4. Visualization:
    - [Create an Analysis using Your own Amazon S3 Data](https://docs.aws.amazon.com/quicksight/latest/user/getting-started-create-analysis-s3.html)
    - [Create a graph in Amazon CloudWatch](https://github.com/aws-samples/realtime-web-analytics-workshop/blob/master/module-3/README.md) the idea is to provide number of clicked and not clicked ads per minute
