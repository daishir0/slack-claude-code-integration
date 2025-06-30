#!/bin/bash

INSTANCE_ID=i-048ef56844dabc969
REGION=ap-northeast-1
PROFILE=yusuke.sato

echo "🧪 Testing EC2 Instance Setup"
echo "============================"

# インスタンスの初期化が完了するまで待機
echo "Waiting for cloud-init to complete..."
aws ssm send-command \
    --instance-ids $INSTANCE_ID \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["cloud-init status --wait"]' \
    --profile $PROFILE \
    --region $REGION \
    --output text \
    --query "Command.CommandId" > /tmp/wait-cmd.txt

sleep 10

echo ""
echo "1️⃣ Checking Node.js installation..."
aws ssm send-command \
    --instance-ids $INSTANCE_ID \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=[
        "su - ec2-user -c \"source ~/.nvm/nvm.sh && node --version\"",
        "su - ec2-user -c \"source ~/.nvm/nvm.sh && npm --version\"",
        "su - ec2-user -c \"source ~/.nvm/nvm.sh && which claude || echo Claude CLI not found\""
    ]' \
    --output text \
    --query "Command.CommandId" \
    --profile $PROFILE \
    --region $REGION > /tmp/node-cmd.txt

sleep 5
aws ssm get-command-invocation \
    --command-id $(cat /tmp/node-cmd.txt) \
    --instance-id $INSTANCE_ID \
    --profile $PROFILE \
    --region $REGION \
    --query "StandardOutputContent" \
    --output text

echo ""
echo "2️⃣ Checking service status..."
aws ssm send-command \
    --instance-ids $INSTANCE_ID \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=[
        "sudo systemctl status slack-claude-bot --no-pager",
        "echo \"\"",
        "echo \"=== Recent logs ===\"",
        "sudo journalctl -u slack-claude-bot -n 30 --no-pager"
    ]' \
    --output text \
    --query "Command.CommandId" \
    --profile $PROFILE \
    --region $REGION > /tmp/service-cmd.txt

sleep 5
aws ssm get-command-invocation \
    --command-id $(cat /tmp/service-cmd.txt) \
    --instance-id $INSTANCE_ID \
    --profile $PROFILE \
    --region $REGION \
    --query "StandardOutputContent" \
    --output text

echo ""
echo "3️⃣ Checking .env file..."
aws ssm send-command \
    --instance-ids $INSTANCE_ID \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=[
        "if [ -f /home/ec2-user/slack-claude-code-integration/.env ]; then",
        "  echo \"✅ .env file exists\"",
        "  echo \"Checking tokens...\"",
        "  grep -q \"SLACK_BOT_TOKEN=xoxb-\" /home/ec2-user/slack-claude-code-integration/.env && echo \"✅ Bot token is set\" || echo \"❌ Bot token missing\"",
        "  grep -q \"SLACK_SIGNING_SECRET=\" /home/ec2-user/slack-claude-code-integration/.env && echo \"✅ Signing secret is set\" || echo \"❌ Signing secret missing\"",
        "  grep -q \"SLACK_APP_TOKEN=xapp-\" /home/ec2-user/slack-claude-code-integration/.env && echo \"✅ App token is set\" || echo \"❌ App token missing\"",
        "else",
        "  echo \"❌ .env file not found\"",
        "fi"
    ]' \
    --output text \
    --query "Command.CommandId" \
    --profile $PROFILE \
    --region $REGION > /tmp/env-cmd.txt

sleep 5
aws ssm get-command-invocation \
    --command-id $(cat /tmp/env-cmd.txt) \
    --instance-id $INSTANCE_ID \
    --profile $PROFILE \
    --region $REGION \
    --query "StandardOutputContent" \
    --output text

echo ""
echo "============================"
echo "To connect manually:"
echo "aws ssm start-session --target $INSTANCE_ID --region $REGION --profile $PROFILE"