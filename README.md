# Slack × Claude Code Tmux Integration

Control Claude Code running in tmux sessions on EC2 from Slack. Operate multiple tmux sessions in parallel with mobile-friendly commands.

## 🎯 Overview

This project enables Slack-based control of **existing Claude Code sessions** running inside tmux.

### Architecture

```
Slack → Slack Bot → Tmux Sessions → Claude Code
```

### Key Features

- **Short Commands**: `/cl` (list sessions), `/c <session>` (connect)
- **Thread-Based Dialog**: Manage each session in separate threads
- **Async Processing**: No timeout, infinite wait until completion
- **Long-Running Support**: Elapsed time display with dynamic update intervals
- **Auto-Split**: Long outputs automatically split into multiple messages
- **Mobile-Friendly**: Easy operation with short commands

## 🚀 Setup Guide

### Prerequisites

- Node.js 18+
- tmux
- Claude Code CLI (running in tmux sessions)
- Slack Workspace admin access

### 1. Create Slack App

#### 1-1. Create New Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Enter App name (e.g., `Claude Code Bot`) and select Workspace
4. Click **"Create App"**

#### 1-2. Enable Socket Mode

1. Select **"Socket Mode"** from left menu
2. Toggle **"Enable Socket Mode"** to ON
3. Enter Token Name (e.g., `socket-token`)
4. Select **`connections:write`** under **"Add Scope"**
5. Copy generated token (`xapp-...`)

#### 1-3. Configure OAuth & Permissions

Add the following **"Bot Token Scopes"** under **"OAuth & Permissions"**:
- `app_mentions:read`
- `chat:write`
- `commands`
- `channels:history`
- `channels:read`
- `groups:history`
- `groups:read`
- `im:history`
- `im:read`
- `im:write`

#### 1-4. Configure Event Subscriptions

Toggle **"Enable Events"** ON under **"Event Subscriptions"**, add under **"Subscribe to bot events"**:
- `app_mention`
- `message.channels`
- `message.groups`
- `message.im`

#### 1-5. Configure Slash Commands

Create commands under **"Slash Commands"** → **"Create New Command"**:

**Command 1:**
- **Command**: `/cl`
- **Request URL**: `https://example.com` (unused in Socket Mode)
- **Short Description**: `List tmux sessions`

**Command 2:**
- **Command**: `/c`
- **Request URL**: `https://example.com` (unused in Socket Mode)
- **Short Description**: `Connect to tmux session`

#### 1-6. Install to Workspace

1. Click **"Install App"** → **"Install to Workspace"**
2. Copy **Bot User OAuth Token** (`xoxb-...`)
3. Copy **Signing Secret** from **"Basic Information"** → **"App Credentials"**

### 2. Project Setup

#### 2-1. Clone Repository

```bash
git clone https://github.com/daishir0/slack-claude-code-integration.git
cd slack-claude-code-integration
```

#### 2-2. Configure Environment Variables

```bash
# Create .env file in slack-bot directory
cd slack-bot
cp .env.example .env

# Edit .env file
nano .env
```

**.env file contents:**

```env
# Slack App Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here

# Debug (optional)
DEBUG=false
```

#### 2-3. Install Dependencies

```bash
# Run in root directory
cd ..
npm install

# Install slack-bot dependencies
cd slack-bot && npm install && cd ..

# Build TypeScript
npm run build
```

### 3. Prepare Tmux Sessions

```bash
# Create Claude Code session
tmux new -s myproject
claude  # Start Claude Code inside tmux

# Create another session (optional)
tmux new -s another-project
claude
```

### 4. Start Application

```bash
# Build TypeScript
npm run build

# Start Slack Bot
npm run start:bot

# Or run in background
nohup npm run start:bot > app.log 2>&1 &
```

**Expected startup output:**

```
⚡️ Slack Claude Code Bot (Tmux Mode) is running!
📋 Commands:
  /cl - List tmux sessions
  /c <session> - Connect to tmux session
[INFO]  socket-mode:SocketModeClient:0 Now connected to Slack
```

### 5. Start Using in Slack

#### 5-1. Invite Bot to Channel

```
/invite @Claude Code Bot
```

#### 5-2. List Sessions

```
/cl
```

**Example response:**

```
📋 Available tmux sessions:

1. myproject
2. another-project

To connect: /c <number or name>
Example: /c 1 or /c myproject
```

#### 5-3. Connect to Session

```
/c 1
```

**Example response:**

```
✅ Connected to myproject
📁 /home/user/myproject

Enter commands freely in this thread
```

#### 5-4. Chat in Thread

```
Show current time
```

**Example response:**

```
✅ Completed (3 seconds)

🕐 Current date and time
October 31, 2025 (Friday) 11:30:00 AM JST
```

## 📖 Usage

### Basic Operations

1. `/cl` - List tmux sessions
2. `/c <session>` - Connect to session (auto-creates thread)
3. Send messages in thread - Send commands to Claude Code

### Feature Details

#### Async Processing

- No timeout, infinite wait until completion
- Shows elapsed time during processing (e.g., `🔄 Processing... ⏱️ 1m 30s`)
- Dynamic update intervals:
  - First 30 seconds: every 2 seconds
  - 30 seconds ~ 5 minutes: every 5 seconds
  - 5 minutes ~ 30 minutes: every 10 seconds
  - Over 30 minutes: every 30 seconds

#### Auto-Split Long Outputs

- Outputs over 2500 characters automatically split into multiple messages
- Each message numbered (e.g., `[1/3]`, `[2/3]`, `[3/3]`)

#### Session Management

- Auto-maintains thread_ts ⇔ tmux session mapping
- Auto-cleanup after 60 minutes of inactivity
- Persisted in `session-mapping.json` (restored after restart)

## 🔧 Advanced Configuration

### Environment Variables

| Variable             | Description             | Example                 |
| -------------------- | ----------------------- | ----------------------- |
| SLACK_BOT_TOKEN      | Bot User OAuth Token    | `xoxb-123...`           |
| SLACK_SIGNING_SECRET | App signing secret      | `abc123...`             |
| SLACK_APP_TOKEN      | App-Level Token         | `xapp-1-...`            |
| DEBUG                | Debug log output        | `false`                 |

### Running with PM2

```bash
# Install PM2
npm install -g pm2

# Build TypeScript
npm run build

# Start application
pm2 start dist/slack-bot/index.js --name slack-claude-bot

# View logs
pm2 logs slack-claude-bot

# Restart
pm2 restart slack-claude-bot

# Setup auto-start
pm2 startup
pm2 save
```

## 🏗️ Project Structure

```
slack-claude-code-integration/
├── slack-bot/                # Slack Bot (tmux-based)
│   ├── index.ts              # Main bot implementation
│   ├── tmux-connector.ts     # Tmux operations
│   ├── session-manager.ts    # Session management
│   ├── async-executor.ts     # Async execution
│   └── package.json
├── dist/                     # TypeScript build output
├── .gitignore                # Git exclusion settings
├── package.json              # Root package definition
├── tsconfig.json             # TypeScript config
└── README.md                 # This file
```

## 🔐 Security

### Credential Management

- **Never** commit `.env` file to Git
- Rotate tokens regularly
- Use environment variables in production

### Access Control

- Invite bot only to specific channels
- Use in private channels recommended
- Filter by user list as needed

## 🚨 Troubleshooting

### "Bot is not responding"

1. Verify bot is invited to channel:
   ```
   /invite @Claude Code Bot
   ```

2. Check Event Subscriptions:
   - `app_mention`
   - `message.channels`
   - `message.groups`
   - `message.im`

### "No tmux sessions found"

```bash
# Check tmux sessions
tmux ls

# Create session if none exists
tmux new -s myproject
claude
```

### View Logs

```bash
# When using PM2
pm2 logs slack-claude-bot

# When running directly
tail -f app.log

# Error logs only
grep ERROR app.log
```

## 📚 References

- [Slack Bolt Framework](https://slack.dev/bolt-js)
- [Claude Code CLI](https://claude.ai/code)
- [Slack API Documentation](https://api.slack.com/docs)
- [tmux Documentation](https://github.com/tmux/tmux/wiki)

## 📄 License

MIT License

## 🙏 Acknowledgments

This project is based on the original MCP-based implementation by [Engineers Hub Ltd](https://github.com/engineers-hub). Special thanks for their original work and inspiration.

**Additional credits:**
- [Claude Code](https://claude.ai/code) by Anthropic
- [Slack API](https://api.slack.com)
- [Node.js](https://nodejs.org)

---

**Last Updated**: October 2025

---

# Slack × Claude Code tmux統合

EC2上のtmux内で動作するClaude CodeをSlackから操作できる統合システムです。複数のtmuxセッションを並行操作し、スマホからも快適に利用できます。

## 🎯 概要

このプロジェクトは、tmux内で動作している**既存のClaude Codeセッション**をSlackから操作可能にします。

### アーキテクチャ

```
Slack → Slack Bot → Tmux Sessions → Claude Code
```

### 主な機能

- **短縮コマンド**: `/cl`（セッション一覧）、`/c <session>`（接続）
- **スレッドベース対話**: 各セッションを個別のスレッドで管理
- **非同期処理**: タイムアウトなし、完了まで無限待機
- **長時間処理対応**: 経過時間表示と動的更新頻度調整
- **自動分割**: 長い出力を自動的に複数メッセージに分割
- **スマホ対応**: 短いコマンドで快適に操作

## 🚀 セットアップガイド

### 前提条件

- Node.js 18以上
- tmux
- Claude Code CLI（tmuxセッション内で起動済み）
- Slack Workspace管理者権限

### 1. Slack App作成

#### 1-1. 新しいSlack Appを作成

1. https://api.slack.com/apps にアクセス
2. **"Create New App"** → **"From scratch"** を選択
3. App名（例: `Claude Code Bot`）とWorkspaceを選択
4. **"Create App"** をクリック

#### 1-2. Socket Modeを有効化

1. 左側メニューから **"Socket Mode"** を選択
2. **"Enable Socket Mode"** をONに切り替え
3. Token Nameに任意の名前を入力（例: `socket-token`）
4. **"Add Scope"** で **`connections:write`** を選択
5. **"Generate"** で生成されたトークン（`xapp-...`）をコピー

#### 1-3. OAuth & Permissionsの設定

**"OAuth & Permissions"** → **"Bot Token Scopes"** で以下を追加:
- `app_mentions:read`
- `chat:write`
- `commands`
- `channels:history`
- `channels:read`
- `groups:history`
- `groups:read`
- `im:history`
- `im:read`
- `im:write`

#### 1-4. Event Subscriptionsの設定

**"Event Subscriptions"** → **"Enable Events"** をON、**"Subscribe to bot events"** で以下を追加:
- `app_mention`
- `message.channels`
- `message.groups`
- `message.im`

#### 1-5. Slash Commandsの設定

**"Slash Commands"** → **"Create New Command"** で以下を作成:

**コマンド1:**
- **Command**: `/cl`
- **Request URL**: `https://example.com` (Socket Modeでは未使用)
- **Short Description**: `tmuxセッション一覧`

**コマンド2:**
- **Command**: `/c`
- **Request URL**: `https://example.com` (Socket Modeでは未使用)
- **Short Description**: `tmuxセッションに接続`

#### 1-6. ワークスペースにインストール

1. **"Install App"** → **"Install to Workspace"** をクリック
2. **Bot User OAuth Token** (`xoxb-...`) をコピー
3. **"Basic Information"** → **"App Credentials"** から **Signing Secret** をコピー

### 2. プロジェクトのセットアップ

#### 2-1. リポジトリのクローン

```bash
git clone https://github.com/daishir0/slack-claude-code-integration.git
cd slack-claude-code-integration
```

#### 2-2. 環境変数の設定

```bash
# slack-botディレクトリに.envファイルを作成
cd slack-bot
cp .env.example .env

# .envファイルを編集
nano .env
```

**.envファイルの内容:**

```env
# Slack App Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here

# Debug (optional)
DEBUG=false
```

#### 2-3. 依存関係のインストール

```bash
# ルートディレクトリで実行
cd ..
npm install

# slack-botディレクトリ
cd slack-bot && npm install && cd ..

# TypeScriptをビルド
npm run build
```

### 3. tmuxセッションの準備

```bash
# Claude Codeセッションを作成
tmux new -s myproject
claude  # tmux内でClaude Codeを起動

# 別のセッションを作成（オプション）
tmux new -s another-project
claude
```

### 4. アプリケーションの起動

```bash
# TypeScriptをビルド
npm run build

# Slack Botを起動
npm run start:bot

# またはバックグラウンドで起動
nohup npm run start:bot > app.log 2>&1 &
```

**正常起動時の出力:**

```
⚡️ Slack Claude Code Bot (Tmux Mode) is running!
📋 Commands:
  /cl - List tmux sessions
  /c <session> - Connect to tmux session
[INFO]  socket-mode:SocketModeClient:0 Now connected to Slack
```

### 5. Slackでの利用開始

#### 5-1. Botをチャンネルに招待

```
/invite @Claude Code Bot
```

#### 5-2. セッション一覧を表示

```
/cl
```

**応答例:**

```
📋 利用可能なtmuxセッション:

1. myproject
2. another-project

接続するには: /c <番号または名前>
例: /c 1 または /c myproject
```

#### 5-3. セッションに接続

```
/c 1
```

**応答例:**

```
✅ myproject に接続しました
📁 /home/user/myproject

このスレッド内で自由にコマンドを入力してください
```

#### 5-4. スレッド内で対話

```
現在の時刻を表示して
```

**応答例:**

```
✅ 完了 (3秒)

🕐 現在の日時
2025年10月31日（金曜日）11時30分00秒 JST
```

## 📖 使い方

### 基本操作

1. `/cl` - tmuxセッション一覧を表示
2. `/c <session>` - セッションに接続（スレッドが自動作成）
3. スレッド内でメッセージ送信 - Claude Codeに命令を送信

### 機能詳細

#### 非同期処理

- タイムアウトなし、完了まで無限待機
- 処理中は経過時間を表示（例: `🔄 処理中... ⏱️ 1分30秒`）
- 更新頻度は動的調整:
  - 最初の30秒: 2秒ごと
  - 30秒〜5分: 5秒ごと
  - 5分〜30分: 10秒ごと
  - 30分以上: 30秒ごと

#### 長い出力の自動分割

- 2500文字を超える出力は自動的に複数メッセージに分割
- 各メッセージに番号表示（例: `[1/3]`, `[2/3]`, `[3/3]`）

#### セッション管理

- thread_ts ⇔ tmuxセッションのマッピングを自動保持
- 60分非アクティブで自動クリーンアップ
- `session-mapping.json`に永続化（再起動後も復元）

## 🔧 詳細設定

### 環境変数

| 変数名               | 説明                       | 例                         |
| -------------------- | -------------------------- | -------------------------- |
| SLACK_BOT_TOKEN      | Bot User OAuth Token       | `xoxb-123...`              |
| SLACK_SIGNING_SECRET | アプリの署名シークレット   | `abc123...`                |
| SLACK_APP_TOKEN      | App-Level Token            | `xapp-1-...`               |
| DEBUG                | デバッグログの出力         | `false`                    |

### PM2での運用

```bash
# PM2のインストール
npm install -g pm2

# TypeScriptをビルド
npm run build

# アプリケーションの起動
pm2 start dist/slack-bot/index.js --name slack-claude-bot

# ログの確認
pm2 logs slack-claude-bot

# 再起動
pm2 restart slack-claude-bot

# 自動起動設定
pm2 startup
pm2 save
```

## 🏗️ プロジェクト構造

```
slack-claude-code-integration/
├── slack-bot/                # Slack Bot（tmuxベース）
│   ├── index.ts              # メインBot実装
│   ├── tmux-connector.ts     # tmux操作
│   ├── session-manager.ts    # セッション管理
│   ├── async-executor.ts     # 非同期実行
│   └── package.json
├── dist/                     # TypeScriptビルド出力
├── .gitignore                # Git除外設定
├── package.json              # ルートパッケージ定義
├── tsconfig.json             # TypeScript設定
└── README.md                 # このファイル
```

## 🔐 セキュリティ

### 認証情報の管理

- `.env`ファイルは**絶対に**Gitにコミットしない
- トークンは定期的にローテーション
- 本番環境では環境変数を使用

### アクセス制限

- Botを特定のチャンネルのみに招待
- プライベートチャンネルでの利用を推奨
- 必要に応じてユーザーリストでフィルタリング

## 🚨 トラブルシューティング

### "Bot is not responding"

1. Botがチャンネルに招待されているか確認:
   ```
   /invite @Claude Code Bot
   ```

2. Event Subscriptionsを確認:
   - `app_mention`
   - `message.channels`
   - `message.groups`
   - `message.im`

### "No tmux sessions found"

```bash
# tmuxセッションを確認
tmux ls

# セッションが存在しない場合は作成
tmux new -s myproject
claude
```

### ログの確認

```bash
# PM2使用時
pm2 logs slack-claude-bot

# 直接実行時
tail -f app.log

# エラーログのみ
grep ERROR app.log
```

## 📚 参考リンク

- [Slack Bolt Framework](https://slack.dev/bolt-js)
- [Claude Code CLI](https://claude.ai/code)
- [Slack API Documentation](https://api.slack.com/docs)
- [tmux Documentation](https://github.com/tmux/tmux/wiki)

## 📄 ライセンス

MIT License

## 🙏 謝辞

このプロジェクトは、[Engineers Hub Ltd](https://github.com/engineers-hub) による元のMCPベース実装に基づいています。元の実装に感謝を申し上げます。

**その他のクレジット:**
- [Claude Code](https://claude.ai/code) by Anthropic
- [Slack API](https://api.slack.com)
- [Node.js](https://nodejs.org)

---

**最終更新**: 2025年10月
