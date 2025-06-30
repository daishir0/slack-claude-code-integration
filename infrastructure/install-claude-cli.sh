#!/bin/bash

# EC2インスタンスにClaude CLIをインストールするスクリプト

INSTANCE_ID=i-048ef56844dabc969
REGION=ap-northeast-1
PROFILE=yusuke.sato

echo "🤖 Installing Claude CLI on EC2 instance..."
echo "==========================================="

aws ssm send-command \
    --instance-ids $INSTANCE_ID \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=[
        "echo \"Installing Anthropic Claude CLI...\"",
        "# Try to install the official Anthropic Claude CLI",
        "su - ec2-user -c \"source ~/.nvm/nvm.sh && npm install -g @anthropic/claude-cli || echo Failed to install @anthropic/claude-cli\"",
        "# Alternative: Install claude-code package",
        "su - ec2-user -c \"source ~/.nvm/nvm.sh && npm install -g claude-code || echo Failed to install claude-code\"",
        "# Check what got installed",
        "su - ec2-user -c \"source ~/.nvm/nvm.sh && npm list -g --depth=0\"",
        "# Look for any claude executable",
        "find /home/ec2-user/.nvm -name \"claude*\" -type f -executable 2>/dev/null | head -10",
        "# If claude-code was installed, create a symlink",
        "if [ -f /home/ec2-user/.nvm/versions/node/v22.17.0/bin/claude-code ]; then",
        "  ln -sf /home/ec2-user/.nvm/versions/node/v22.17.0/bin/claude-code /home/ec2-user/.nvm/versions/node/v22.17.0/bin/claude",
        "  echo \"Created symlink claude -> claude-code\"",
        "fi",
        "# Final check",
        "su - ec2-user -c \"source ~/.nvm/nvm.sh && which claude || echo Claude CLI not found in PATH\""
    ]' \
    --output text \
    --query "Command.CommandId" \
    --profile $PROFILE \
    --region $REGION > /tmp/install-claude-cmd.txt

COMMAND_ID=$(cat /tmp/install-claude-cmd.txt)
echo "Command ID: $COMMAND_ID"
echo "Waiting for installation to complete..."

sleep 15

echo ""
echo "Installation results:"
echo "===================="
aws ssm get-command-invocation \
    --command-id $COMMAND_ID \
    --instance-id $INSTANCE_ID \
    --profile $PROFILE \
    --region $REGION \
    --query "StandardOutputContent" \
    --output text

echo ""
echo "If installation was successful, restart the service:"
echo "aws ssm send-command --instance-ids $INSTANCE_ID --document-name \"AWS-RunShellScript\" --parameters 'commands=[\"sudo systemctl restart slack-claude-bot\"]' --profile $PROFILE --region $REGION"