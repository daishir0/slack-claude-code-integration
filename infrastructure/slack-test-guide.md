# Slack Claude Code Bot テストガイド

## 接続情報
- **EC2 Instance ID**: i-048ef56844dabc969
- **Public IP**: 13.230.157.249
- **Service Status**: Active (Running)

## Slackでのテスト方法

### 1. ボットをメンション
Slackチャンネルで以下のようにボットをメンションしてテストできます：

```
@ClaudeCode ファイルを作成して
```

### 2. ダイレクトメッセージ
ボットに直接DMを送ることもできます。

### 3. スラッシュコマンド
```
/claude ファイルを作成して
```

## 動作確認コマンド

### サービスステータス確認
```bash
aws ssm start-session --target i-048ef56844dabc969 --region ap-northeast-1 --profile yusuke.sato
```

接続後：
```bash
# サービスステータス
sudo systemctl status slack-claude-bot

# リアルタイムログ
sudo journalctl -u slack-claude-bot -f

# プロセス確認
ps aux | grep node | grep slack-bot
```

## トラブルシューティング

### ログ確認
```bash
# 最新のログ
sudo journalctl -u slack-claude-bot -n 50

# エラーログのみ
sudo journalctl -u slack-claude-bot -p err
```

### サービス再起動
```bash
sudo systemctl restart slack-claude-bot
```

### 環境変数確認
```bash
cat /home/ec2-user/slack-claude-code-integration/.env
```

## 現在の設定
- **Node.js**: v22.17.0 (nvm経由)
- **作業ディレクトリ**: `/home/ec2-user/test-projects`
- **動作モード**: PRODUCTION MODE（Claude CLIを使用予定）
- **Slack接続**: Socket Mode（WebSocket）

## 注意事項
- 現在Claude CLIはインストールされていないため、実際のClaude応答は得られません
- テストモードに切り替える場合は、.envファイルで`DEBUG=true`に設定してください
- ボットトークンはAWS Secrets Managerから自動的に取得されています