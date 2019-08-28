#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { DataExperimentStack } from '../lib/data-experiment-stack';

const app = new cdk.App();
new DataExperimentStack(app, 'DataExperimentStack');
