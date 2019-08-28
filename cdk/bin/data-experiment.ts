#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { MainStack } from '../lib/main-stack';

const app = new cdk.App();
new MainStack(app, 'DataExperimentStack');
