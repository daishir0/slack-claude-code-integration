#!/bin/bash

echo "🚀 Deploying and Testing Slack Claude Bot on EC2"
echo "================================================"

# 1. シークレットをセットアップ
echo ""
echo "1️⃣ Setting up secrets..."
./setup-secrets.sh

# 2. CDKデプロイ
echo ""
echo "2️⃣ Deploying EC2 instance..."
npm run deploy

# 3. デプロイ完了後の情報を取得
echo ""
echo "3️⃣ Getting deployment outputs..."
PROFILE=${AWS_PROFILE:-yusuke.sato}
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name SlackClaudeEC2Stack \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" \
  --output text \
  --profile $PROFILE)

REGION=$(aws configure get region --profile $PROFILE)

echo "Instance ID: $INSTANCE_ID"
echo "Region: $REGION"

# 4. インスタンスが起動するまで待機
echo ""
echo "4️⃣ Waiting for instance to be ready..."
aws ec2 wait instance-status-ok --instance-ids $INSTANCE_ID --profile $PROFILE

# 5. SSM Session Manager で接続してステータス確認
echo ""
echo "5️⃣ Checking application status..."
echo ""
echo "📋 Commands to check the bot status:"
echo ""
echo "# Connect to the instance:"
echo "aws ssm start-session --target $INSTANCE_ID --region $REGION --profile $PROFILE"
echo ""
echo "# Once connected, run these commands:"
echo "sudo systemctl status slack-claude-bot"
echo "sudo journalctl -u slack-claude-bot -f"
echo ""
echo "# Check if .env file was created properly:"
echo "cat /home/ec2-user/slack-claude-code-integration/.env"
echo ""
echo "# Test the bot manually:"
echo "cd /home/ec2-user/slack-claude-code-integration"
echo "node dist/slack-bot/index.js"
echo ""
echo "✅ Deployment complete! Use the commands above to verify the bot is working."