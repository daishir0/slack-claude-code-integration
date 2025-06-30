#!/bin/bash

# EC2インスタンス上で実行するテストスクリプト

echo "🧪 Testing Slack Claude Bot"
echo "=========================="

# 1. サービスステータス確認
echo ""
echo "1️⃣ Checking service status..."
sudo systemctl status slack-claude-bot --no-pager

# 2. .env ファイル確認
echo ""
echo "2️⃣ Checking environment file..."
if [ -f /home/ec2-user/slack-claude-code-integration/.env ]; then
    echo "✅ .env file exists"
    # トークンが設定されているか確認（値は表示しない）
    if grep -q "SLACK_BOT_TOKEN=xoxb-" /home/ec2-user/slack-claude-code-integration/.env; then
        echo "✅ SLACK_BOT_TOKEN is set"
    else
        echo "❌ SLACK_BOT_TOKEN is not set properly"
    fi
    if grep -q "SLACK_SIGNING_SECRET=" /home/ec2-user/slack-claude-code-integration/.env; then
        echo "✅ SLACK_SIGNING_SECRET is set"
    else
        echo "❌ SLACK_SIGNING_SECRET is not set"
    fi
    if grep -q "SLACK_APP_TOKEN=xapp-" /home/ec2-user/slack-claude-code-integration/.env; then
        echo "✅ SLACK_APP_TOKEN is set"
    else
        echo "❌ SLACK_APP_TOKEN is not set properly"
    fi
else
    echo "❌ .env file not found"
fi

# 3. Node.js バージョン確認
echo ""
echo "3️⃣ Checking Node.js version..."
node --version

# 4. アプリケーションディレクトリ確認
echo ""
echo "4️⃣ Checking application directory..."
if [ -d /home/ec2-user/slack-claude-code-integration ]; then
    echo "✅ Application directory exists"
    if [ -f /home/ec2-user/slack-claude-code-integration/dist/slack-bot/index.js ]; then
        echo "✅ Compiled JavaScript files exist"
    else
        echo "❌ Compiled JavaScript files not found"
    fi
else
    echo "❌ Application directory not found"
fi

# 5. ログの最新エントリ
echo ""
echo "5️⃣ Recent logs:"
sudo journalctl -u slack-claude-bot --no-pager -n 20

# 6. プロセス確認
echo ""
echo "6️⃣ Checking if process is running..."
if pgrep -f "node dist/slack-bot/index.js" > /dev/null; then
    echo "✅ Bot process is running"
    ps aux | grep "node dist/slack-bot/index.js" | grep -v grep
else
    echo "❌ Bot process is not running"
fi

echo ""
echo "==============================="
echo "Test complete!"