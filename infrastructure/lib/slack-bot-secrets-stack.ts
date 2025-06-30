import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class SlackBotSecretsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Slack Bot Token
    const botTokenSecret = new secretsmanager.Secret(this, 'SlackBotToken', {
      secretName: 'slack-claude-bot/bot-token',
      description: 'Slack Bot User OAuth Token',
    });

    // Slack Signing Secret
    const signingSecret = new secretsmanager.Secret(this, 'SlackSigningSecret', {
      secretName: 'slack-claude-bot/signing-secret',
      description: 'Slack Signing Secret',
    });

    // Slack App Token
    const appTokenSecret = new secretsmanager.Secret(this, 'SlackAppToken', {
      secretName: 'slack-claude-bot/app-token',
      description: 'Slack App-Level Token',
    });

    // SSM パラメータで EC2 インスタンスから参照しやすくする
    new ssm.StringParameter(this, 'BotTokenParam', {
      parameterName: '/slack-claude-bot/bot-token-arn',
      stringValue: botTokenSecret.secretArn,
    });

    new ssm.StringParameter(this, 'SigningSecretParam', {
      parameterName: '/slack-claude-bot/signing-secret-arn',
      stringValue: signingSecret.secretArn,
    });

    new ssm.StringParameter(this, 'AppTokenParam', {
      parameterName: '/slack-claude-bot/app-token-arn',
      stringValue: appTokenSecret.secretArn,
    });

    // 出力
    new cdk.CfnOutput(this, 'UpdateSecretsCommand', {
      value: `aws secretsmanager put-secret-value --secret-id ${botTokenSecret.secretName} --secret-string "xoxb-your-token" --region ${this.region}`,
      description: 'Command to update bot token'
    });
  }
}