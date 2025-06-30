#!/bin/bash

# Secrets Manager にシークレットを作成/更新するスクリプト
#
# 使用方法:
# 1. 環境変数を設定してから実行:
#    export SLACK_BOT_TOKEN="xoxb-your-token"
#    export SLACK_SIGNING_SECRET="your-signing-secret"
#    export SLACK_APP_TOKEN="xapp-your-token"
#    ./setup-secrets.sh
#
# 2. または .env ファイルを読み込んで実行:
#    source ../.env && ./setup-secrets.sh

REGION=${AWS_DEFAULT_REGION:-ap-northeast-1}
PROFILE=${AWS_PROFILE:-yusuke.sato}

echo "🔐 Setting up Slack Claude Bot secrets in AWS Secrets Manager"
echo "============================================================"
echo "Using profile: $PROFILE"

# Check AWS credentials
if ! aws sts get-caller-identity --profile $PROFILE &> /dev/null; then
    echo "❌ AWS credentials not configured for profile: $PROFILE"
    exit 1
fi

# Create or update secrets
echo "📝 Creating/updating secrets..."

# Bot Token
BOT_TOKEN="${SLACK_BOT_TOKEN:-your-bot-token-here}"
aws secretsmanager create-secret \
    --name slack-claude-bot/bot-token \
    --secret-string "$BOT_TOKEN" \
    --region $REGION --profile $PROFILE 2>/dev/null || \
aws secretsmanager update-secret \
    --secret-id slack-claude-bot/bot-token \
    --secret-string "$BOT_TOKEN" \
    --region $REGION --profile $PROFILE

# Signing Secret  
SIGNING_SECRET="${SLACK_SIGNING_SECRET:-your-signing-secret-here}"
aws secretsmanager create-secret \
    --name slack-claude-bot/signing-secret \
    --secret-string "$SIGNING_SECRET" \
    --region $REGION --profile $PROFILE 2>/dev/null || \
aws secretsmanager update-secret \
    --secret-id slack-claude-bot/signing-secret \
    --secret-string "$SIGNING_SECRET" \
    --region $REGION --profile $PROFILE

# App Token
APP_TOKEN="${SLACK_APP_TOKEN:-your-app-token-here}"
aws secretsmanager create-secret \
    --name slack-claude-bot/app-token \
    --secret-string "$APP_TOKEN" \
    --region $REGION --profile $PROFILE 2>/dev/null || \
aws secretsmanager update-secret \
    --secret-id slack-claude-bot/app-token \
    --secret-string "$APP_TOKEN" \
    --region $REGION --profile $PROFILE

echo "✅ Secrets created/updated successfully!"
echo ""
echo "📋 Created secrets:"
echo "  - slack-claude-bot/bot-token"
echo "  - slack-claude-bot/signing-secret"
echo "  - slack-claude-bot/app-token"