#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SlackClaudeEc2Stack } from '../lib/slack-claude-ec2-stack';

const app = new cdk.App();

new SlackClaudeEc2Stack(app, 'SlackClaudeEC2Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  description: 'Slack Claude Bot on EC2 Instance',
});