#!/bin/bash

# リモートでテストスクリプトを実行

INSTANCE_ID=i-09bd0b8d3c2ff94f9
REGION=ap-northeast-1
PROFILE=yusuke.sato

echo "🧪 Running test on remote EC2 instance..."
echo "========================================="

# テストスクリプトをリモートで実行
aws ssm send-command \
    --instance-ids $INSTANCE_ID \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=[
        "echo \"1️⃣ Checking service status...\"",
        "sudo systemctl status slack-claude-bot --no-pager",
        "echo \"\"",
        "echo \"2️⃣ Checking Node.js version...\"",
        "node --version",
        "echo \"\"",
        "echo \"3️⃣ Checking .env file...\"",
        "if [ -f /home/ec2-user/slack-claude-code-integration/.env ]; then echo \"✅ .env file exists\"; else echo \"❌ .env file not found\"; fi",
        "echo \"\"",
        "echo \"4️⃣ Recent logs:\"",
        "sudo journalctl -u slack-claude-bot --no-pager -n 20"
    ]' \
    --output text \
    --query "Command.CommandId" \
    --profile $PROFILE > /tmp/command-id.txt

COMMAND_ID=$(cat /tmp/command-id.txt)

echo "Command ID: $COMMAND_ID"
echo "Waiting for command to complete..."

# コマンドの完了を待つ
sleep 5

# 結果を取得
aws ssm get-command-invocation \
    --command-id $COMMAND_ID \
    --instance-id $INSTANCE_ID \
    --profile $PROFILE \
    --query "StandardOutputContent" \
    --output text

echo ""
echo "========================================="
echo "To connect to the instance manually, run:"
echo "aws ssm start-session --target $INSTANCE_ID --region $REGION --profile $PROFILE"