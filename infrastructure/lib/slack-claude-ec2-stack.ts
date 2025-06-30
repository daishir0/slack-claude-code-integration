import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class SlackClaudeEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC (デフォルトVPCを使用)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
      isDefault: true
    });

    // セキュリティグループ
    const securityGroup = new ec2.SecurityGroup(this, 'SlackClaudeSecurityGroup', {
      vpc,
      description: 'Security group for Slack Claude Bot',
      allowAllOutbound: true
    });

    // SSH アクセスは不要（SSM Session Manager を使用）

    // IAMロール
    const role = new iam.Role(this, 'SlackClaudeEC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
      ]
    });

    // Secrets Manager へのアクセス権限を追加
    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret'
      ],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:slack-claude-bot/*`
      ]
    }));

    // SSM Parameter Store へのアクセス権限を追加
    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParameterHistory'
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/slack-claude-bot/*`
      ]
    }));

    // ユーザーデータ
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'dnf update -y',
      'dnf install -y git amazon-cloudwatch-agent',
      
      // SSM Agent は Amazon Linux 2023 にプリインストールされている
      
      // nvm と Node.js 22 のインストール
      'su - ec2-user -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"',
      'su - ec2-user -c "source ~/.nvm/nvm.sh && nvm install 22 && nvm use 22 && nvm alias default 22"',
      
      // Claude Code CLI のインストール
      'su - ec2-user -c "source ~/.nvm/nvm.sh && npm install -g @anthropic/claude-code"',
      
      // アプリケーションのセットアップ
      'cd /home/ec2-user',
      'git clone https://github.com/engineers-hub-ltd-in-house-project/slack-claude-code-integration.git',
      'cd slack-claude-code-integration',
      'su - ec2-user -c "cd /home/ec2-user/slack-claude-code-integration && source ~/.nvm/nvm.sh && npm install"',
      'su - ec2-user -c "cd /home/ec2-user/slack-claude-code-integration && source ~/.nvm/nvm.sh && npm run build"',
      
      // AWS CLI 設定
      'export AWS_DEFAULT_REGION=' + this.region,
      
      // .env ファイルの作成
      'cd /home/ec2-user/slack-claude-code-integration',
      'touch .env',
      'chmod 600 .env',
      
      // Secrets Manager から環境変数を取得してファイルに書き込む
      'echo "# Slack App Configuration" > .env',
      'echo "SLACK_BOT_TOKEN=$(aws secretsmanager get-secret-value --secret-id slack-claude-bot/bot-token --query SecretString --output text 2>/dev/null || echo "")" >> .env',
      'echo "SLACK_SIGNING_SECRET=$(aws secretsmanager get-secret-value --secret-id slack-claude-bot/signing-secret --query SecretString --output text 2>/dev/null || echo "")" >> .env',
      'echo "SLACK_APP_TOKEN=$(aws secretsmanager get-secret-value --secret-id slack-claude-bot/app-token --query SecretString --output text 2>/dev/null || echo "")" >> .env',
      'echo "" >> .env',
      'echo "# Claude Configuration" >> .env',
      'echo "CLAUDE_PATH=claude" >> .env',
      'echo "PROJECT_PATH=/home/ec2-user/test-projects" >> .env',
      'echo "" >> .env',
      'echo "# Debug Mode" >> .env',
      'echo "DEBUG=true" >> .env',
      
      // テストプロジェクト用ディレクトリ作成
      'mkdir -p /home/ec2-user/test-projects',
      'chown ec2-user:ec2-user /home/ec2-user/test-projects',
      
      // Node.js パスを取得
      'NODE_PATH=$(su - ec2-user -c "source ~/.nvm/nvm.sh && which node")',
      
      // systemd サービスの作成
      'cat > /etc/systemd/system/slack-claude-bot.service << EOF',
      '[Unit]',
      'Description=Slack Claude Bot',
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      'User=ec2-user',
      'WorkingDirectory=/home/ec2-user/slack-claude-code-integration',
      'EnvironmentFile=/home/ec2-user/slack-claude-code-integration/.env',
      "ExecStart='\"$NODE_PATH\"' dist/slack-bot/index.js",
      'Restart=always',
      'Environment=NODE_ENV=production',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      
      'systemctl enable slack-claude-bot',
      'systemctl start slack-claude-bot'
    );

    // EC2インスタンス
    const instance = new ec2.Instance(this, 'SlackClaudeInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023
      }),
      securityGroup,
      role,
      userData,
      // keyName は不要（SSM Session Manager を使用）
    });

    // 出力
    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'EC2 Instance ID'
    });

    new cdk.CfnOutput(this, 'PublicIp', {
      value: instance.instancePublicIp,
      description: 'Public IP Address'
    });

    new cdk.CfnOutput(this, 'SSMCommand', {
      value: `aws ssm start-session --target ${instance.instanceId} --region ${this.region}`,
      description: 'SSM Session Manager connection command'
    });

    new cdk.CfnOutput(this, 'LogsCommand', {
      value: `aws ssm start-session --target ${instance.instanceId} --region ${this.region} --document-name AWS-StartInteractiveCommand --parameters command="sudo journalctl -u slack-claude-bot -f"`,
      description: 'View application logs'
    });
  }
}