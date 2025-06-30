# Slack Claude Code Integration - AWS インフラストラクチャ

このディレクトリには、Slack Claude Code IntegrationをAWS EC2にデプロイするためのCDKコードが含まれています。

## 概要

このCDKスタックは以下のリソースを作成します：

- **EC2インスタンス** (t3.micro) - Amazon Linux 2023
- **IAMロール** - SSM Session ManagerとSecrets Managerへのアクセス権限
- **セキュリティグループ** - アウトバウンド通信のみ許可
- **自動セットアップ** - Node.js、アプリケーション、systemdサービスの設定

## 前提条件

- AWS CLI設定済み（プロファイル: `yusuke.sato`）
- AWS CDKインストール済み
- Node.js 18以上
- Slack App設定済み（Socket Mode有効）

## セットアップ手順

### 1. 依存関係のインストール

```bash
cd infrastructure
npm install
```

### 2. Slackトークンの設定

Slack Appの認証情報をAWS Secrets Managerに保存します：

```bash
./setup-secrets.sh
```

このスクリプトは以下のシークレットを作成します：
- `slack-claude-bot/bot-token` - Slack Bot User OAuth Token
- `slack-claude-bot/signing-secret` - Slack Signing Secret  
- `slack-claude-bot/app-token` - Slack App-Level Token

### 3. CDKのブートストラップ（初回のみ）

```bash
npm run bootstrap
```

### 4. デプロイ

```bash
npm run deploy
```

デプロイには約5-10分かかります。完了すると以下の情報が表示されます：
- EC2インスタンスID
- パブリックIPアドレス
- SSM Session Managerの接続コマンド

### 5. 動作確認

デプロイ完了後、以下のコマンドで動作を確認できます：

```bash
# テストスクリプトの実行
./test-instance.sh

# または手動で接続
aws ssm start-session --target [INSTANCE_ID] --region ap-northeast-1 --profile yusuke.sato
```

## インスタンス上の構成

### ディレクトリ構造
```
/home/ec2-user/
├── slack-claude-code-integration/  # アプリケーション
│   ├── dist/                      # ビルド済みJavaScript
│   ├── node_modules/              # 依存関係
│   └── .env                       # 環境変数（Secrets Managerから自動生成）
└── test-projects/                 # Claude Code作業ディレクトリ
```

### systemdサービス
- サービス名: `slack-claude-bot`
- 自動起動: 有効
- ログ: `journalctl -u slack-claude-bot`

### 環境設定
- Node.js: v22（nvmで管理）
- 作業ディレクトリ: `/home/ec2-user/test-projects`
- 実行ユーザー: `ec2-user`

## 管理コマンド

### サービス管理
```bash
# ステータス確認
sudo systemctl status slack-claude-bot

# 再起動
sudo systemctl restart slack-claude-bot

# ログ確認
sudo journalctl -u slack-claude-bot -f
```

### アプリケーション更新
```bash
cd /home/ec2-user/slack-claude-code-integration
git pull
npm run setup
npm run build
sudo systemctl restart slack-claude-bot
```

### 環境変数の確認・更新
```bash
# 現在の設定確認
cat /home/ec2-user/slack-claude-code-integration/.env

# テストモードに切り替え
sudo sed -i 's/DEBUG=false/DEBUG=true/' /home/ec2-user/slack-claude-code-integration/.env
sudo systemctl restart slack-claude-bot
```

## トラブルシューティング

### サービスが起動しない場合
1. ログを確認: `sudo journalctl -u slack-claude-bot -n 50`
2. Node.jsパスを確認: `which node`
3. 環境変数を確認: `.env`ファイルの内容
4. ビルドエラーを確認: `npm run build`

### Slackに接続できない場合
1. トークンが正しく設定されているか確認
2. ネットワーク接続を確認
3. Slack App設定でSocket Modeが有効か確認

### Claude CLIが動作しない場合
現在、Claude CLIは手動でインストールする必要があります：
```bash
./install-claude-cli.sh
```

## スタックの削除

不要になった場合は以下のコマンドでリソースを削除できます：

```bash
npm run destroy
```

## セキュリティ考慮事項

- EC2インスタンスへのアクセスはSSM Session Manager経由のみ（SSHキーなし）
- Slackトークンは AWS Secrets Managerで管理
- アウトバウンド通信のみ許可（インバウンドは全て拒否）
- IAMロールは最小権限の原則に従って設定

## コスト

- EC2 t3.micro: 約$0.0104/時間（東京リージョン）
- 月額概算: 約$7.5（24時間稼働の場合）
- その他: Secrets Manager、CloudWatch Logsなどの少額料金

## CDKスタック構成

主要なコンポーネント：
- `SlackClaudeEc2Stack` - メインのEC2スタック
- ユーザーデータスクリプトで自動セットアップ
- nvmによるNode.js管理
- systemdによるサービス管理
