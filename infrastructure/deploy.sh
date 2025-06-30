#!/bin/bash

echo "🚀 Deploying Slack Claude Bot to EC2"
echo "===================================="

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured"
    exit 1
fi

# Bootstrap CDK (only needed once per account/region)
echo "📦 Bootstrapping CDK..."
npx cdk bootstrap

# Deploy
echo "🏗️  Deploying stack..."
npx cdk deploy --require-approval never

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. SSH into the instance using the command shown in outputs"
echo "2. Edit /etc/systemd/system/slack-claude-bot.service"
echo "3. Add your Slack tokens as Environment variables"
echo "4. Run: sudo systemctl restart slack-claude-bot"