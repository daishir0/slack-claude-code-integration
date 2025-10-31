# Slack × Claude Code Tmux Integration

Control Claude Code running in tmux sessions on EC2 from Slack. Operate multiple tmux sessions in parallel with mobile-friendly commands.

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Setup Guide](#-setup-guide)
- [Usage](#-usage)
- [Advanced Configuration](#-advanced-configuration)
- [Running with systemd](#running-with-systemd)
- [Performance Tuning](#-performance-tuning)
- [Security Best Practices](#-security-best-practices)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-faq)
- [Project Structure](#️-project-structure)
- [Contributing](#-contributing)
- [Changelog](#-changelog)
- [References](#-references)
- [License](#-license)

## 🎯 Overview

This project enables Slack-based control of **existing Claude Code sessions** running inside tmux. With real-time incremental output delivery, you can monitor progress as commands execute.

### Architecture

```
┌─────────────┐
│   Slack     │
│   (User)    │
└──────┬──────┘
       │ Socket Mode
       │
┌──────▼──────────────────────┐
│   Slack Bot                 │
│   (Node.js + @slack/bolt)   │
│   - /cl (list sessions)     │
│   - /c (connect session)    │
│   - Thread message handler  │
└──────┬──────────────────────┘
       │
       │ tmux operations
       │
┌──────▼──────────────────────┐
│   Tmux Session Manager      │
│   - session-mapping.json    │
│   - Auto cleanup (60min)    │
└──────┬──────────────────────┘
       │
       │ tmux send-keys
       │
┌──────▼──────────────────────┐
│   Tmux Sessions             │
│   ┌─────────────────────┐   │
│   │ Session: myproject  │   │
│   │ ┌─────────────────┐ │   │
│   │ │  Claude Code    │ │   │
│   │ │  CLI            │ │   │
│   │ └─────────────────┘ │   │
│   └─────────────────────┘   │
└─────────────────────────────┘
```

### Key Features

- **Short Commands**: `/cl` (list sessions), `/c <session>` (connect)
- **Thread-Based Dialog**: Manage each session in separate threads
- **Real-Time Incremental Output**: See progress as commands execute (500+ chars)
- **Async Processing**: No timeout, infinite wait until completion
- **Smart Output Extraction**: Automatically extracts relevant output from user prompt onwards
- **Long-Running Support**: Elapsed time display with dynamic update intervals
- **Auto-Split**: Long outputs automatically split into multiple messages
- **Mobile-Friendly**: Easy operation with short commands
- **Completion Detection**: Stable completion detection with 2-check confirmation

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
# Create .env file in project root
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
# Install all dependencies
npm install

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
✅ Completed (3 seconds) - Messages sent: 1

📄 [Final 1]
[Output content here]
```

## 📖 Usage

### Basic Operations

1. `/cl` - List tmux sessions
2. `/c <session>` - Connect to session (auto-creates thread)
3. Send messages in thread - Send commands to Claude Code

### Feature Details

#### Real-Time Incremental Output

- Outputs 500+ characters trigger incremental message delivery
- Shows progress with `📄 [In Progress N]` markers
- Final output sent with `📄 [Final N]` markers
- Automatically filters out processing indicators

#### Async Processing

- No timeout, infinite wait until completion
- Shows elapsed time during processing (e.g., `🔄 Processing... ⏱️ 1m 30s`)
- Dynamic update intervals:
  - First 30 seconds: every 2 seconds
  - 30 seconds ~ 5 minutes: every 5 seconds
  - 5 minutes ~ 30 minutes: every 10 seconds
  - Over 30 minutes: every 30 seconds

#### Smart Output Extraction

- Automatically finds user prompt (line starting with `> `)
- Extracts only relevant output from that point onwards
- Filters out:
  - Processing indicators (✢, ✻, ∴, etc.)
  - System messages ("Thinking…", "undefined…")
  - Decorative lines
  - Empty prompt lines

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

### Running with systemd

Create systemd service file:

```bash
sudo nano /etc/systemd/system/slack-claude-bot.service
```

Service file content:

```ini
[Unit]
Description=Slack Claude Code Bot (Tmux Integration)
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/slack-claude-code-integration
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/slack-bot/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=slack-claude-bot

[Install]
WantedBy=multi-user.target
```

Start and manage service:

```bash
# Enable and start service
sudo systemctl enable slack-claude-bot.service
sudo systemctl start slack-claude-bot.service

# Check status
sudo systemctl status slack-claude-bot.service

# View logs
sudo journalctl -u slack-claude-bot.service -f

# Restart service
sudo systemctl restart slack-claude-bot.service
```

## ⚡ Performance Tuning

### Message Delivery Optimization

Current settings in `slack-bot/async-executor.ts`:
- Incremental output threshold: 500 characters
- Message split size: 2500 characters

To adjust:

```typescript
// Change incremental output threshold
if (diff.length >= 300) {  // 500 → 300 for more frequent updates
  // Send incremental output
}

// Change split size
const chunks = this.splitOutput(output, 3000);  // 2500 → 3000 for larger chunks
```

### Tmux Performance

Increase history buffer in `~/.tmux.conf`:

```bash
set-option -g history-limit 50000
```

## 🔐 Security Best Practices

### Credential Management

1. **Never commit `.env` file to Git**
   - Add to `.gitignore`
   - Use environment variables in production

2. **Token Rotation**
   - Rotate Bot tokens every 90 days
   - Monitor token usage regularly

3. **Access Control**
   - Invite bot only to specific channels
   - Use private channels for sensitive operations
   - Implement user allowlist if needed

### AWS Security (for EC2 deployment)

```bash
# Use AWS Secrets Manager
aws secretsmanager create-secret \
  --name slack-claude-bot \
  --secret-string file://.env

# Restrict EC2 instance access with IAM roles
```

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

3. Check service status:
   ```bash
   sudo systemctl status slack-claude-bot.service
   # or
   pm2 status
   ```

### "No tmux sessions found"

```bash
# Check tmux sessions
tmux ls

# Create session if none exists
tmux new -s myproject
claude
```

### "Output not showing correctly"

Check logs for output extraction:
```bash
# systemd logs
sudo journalctl -u slack-claude-bot.service -f | grep "Found user prompt"

# PM2 logs
pm2 logs slack-claude-bot | grep "Found user prompt"
```

### View Logs

```bash
# When using systemd
sudo journalctl -u slack-claude-bot.service -f

# When using PM2
pm2 logs slack-claude-bot

# When running directly
tail -f app.log

# Error logs only
grep ERROR app.log
```

## ❓ FAQ

### Q: Can multiple users use this simultaneously?

A: Yes. Each user can connect to different tmux sessions and work in parallel.

### Q: What happens if the session disconnects?

A: The tmux session continues running. Reconnect with `/c` command to resume work.

### Q: Is command history preserved?

A: Yes, as long as the tmux session exists, Claude Code history is preserved.

### Q: Do long-running tasks timeout?

A: No, there is no timeout. The bot waits infinitely until completion, displaying elapsed time periodically.

### Q: Can I see progress during long operations?

A: Yes! The real-time incremental output feature sends progress updates as output accumulates (every 500+ characters).

## 🏗️ Project Structure

```
slack-claude-code-integration/
├── slack-bot/                # Slack Bot (tmux-based)
│   ├── index.ts              # Main bot implementation
│   ├── tmux-connector.ts     # Tmux operations
│   ├── session-manager.ts    # Session management
│   ├── async-executor.ts     # Async execution & incremental output
│   └── package.json
├── dist/                     # TypeScript build output
├── .gitignore                # Git exclusion settings
├── .env.example              # Environment variable template
├── package.json              # Root package definition
├── tsconfig.json             # TypeScript config
└── README.md                 # This file
```

## 🤝 Contributing

Pull requests are welcome! Please follow these steps:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript strict mode
- Follow ESLint rules
- Write clear commit messages in Japanese or English
- Add tests for new features

## 📝 Changelog

### [2.0.0] - 2025-10-31

#### Added
- Real-time incremental output delivery (Plan 1)
- Stable completion detection with 2-check confirmation
- Automatic user prompt position detection
- Smart output filtering (removes processing indicators)
- Detailed logging for debugging

#### Changed
- Message length limit handling (chat.update vs chat.postMessage)
- Output extraction now starts from user prompt (`> `)

#### Fixed
- False positive completion detection
- Output containing past history
- Empty output messages

### [1.0.0] - 2025-10-01

#### Added
- Initial release
- tmux-based session management
- Async processing with status updates
- Dynamic update intervals
- Auto-split long outputs

## 📚 References

- [Slack Bolt Framework](https://slack.dev/bolt-js)
- [Claude Code CLI](https://claude.ai/code)
- [Slack API Documentation](https://api.slack.com/docs)
- [tmux Documentation](https://github.com/tmux/tmux/wiki)

## 📄 License

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 🙏 Acknowledgments

This project is based on the original MCP-based implementation by [Engineers Hub Ltd](https://github.com/engineers-hub). Special thanks for their original work and inspiration.

**Additional credits:**
- [Claude Code](https://claude.ai/code) by Anthropic
- [Slack API](https://api.slack.com)
- [Node.js](https://nodejs.org)

---

**Last Updated**: October 31, 2025

---

# Slack × Claude Code tmux統合

EC2上のtmux内で動作するClaude CodeをSlackから操作できる統合システムです。複数のtmuxセッションを並行操作し、リアルタイムで進捗を確認しながら快適に作業できます。

## 📑 目次

- [概要](#-概要)
- [主な機能](#主な機能)
- [アーキテクチャ](#アーキテクチャ)
- [セットアップガイド](#-セットアップガイド)
- [使い方](#-使い方)
- [詳細設定](#-詳細設定)
- [systemdでの運用](#systemdでの運用)
- [パフォーマンスチューニング](#-パフォーマンスチューニング)
- [セキュリティベストプラクティス](#-セキュリティベストプラクティス)
- [トラブルシューティング](#-トラブルシューティング)
- [よくある質問](#-よくある質問)
- [プロジェクト構造](#️-プロジェクト構造)
- [コントリビューション](#-コントリビューション)
- [変更履歴](#-変更履歴)
- [参考リンク](#-参考リンク)
- [ライセンス](#-ライセンス)

## 🎯 概要

このプロジェクトは、tmux内で動作している**既存のClaude Codeセッション**をSlackから操作可能にします。リアルタイム差分送信により、コマンド実行中の進捗をリアルタイムで確認できます。

### アーキテクチャ

```
┌─────────────┐
│   Slack     │
│   (User)    │
└──────┬──────┘
       │ Socket Mode
       │
┌──────▼──────────────────────┐
│   Slack Bot                 │
│   (Node.js + @slack/bolt)   │
│   - /cl (セッション一覧)    │
│   - /c (セッション接続)     │
│   - スレッドメッセージ処理  │
└──────┬──────────────────────┘
       │
       │ tmux操作
       │
┌──────▼──────────────────────┐
│   Tmuxセッション管理         │
│   - session-mapping.json    │
│   - 自動クリーンアップ(60分)│
└──────┬──────────────────────┘
       │
       │ tmux send-keys
       │
┌──────▼──────────────────────┐
│   Tmuxセッション             │
│   ┌─────────────────────┐   │
│   │ Session: myproject  │   │
│   │ ┌─────────────────┐ │   │
│   │ │  Claude Code    │ │   │
│   │ │  CLI            │ │   │
│   │ └─────────────────┘ │   │
│   └─────────────────────┘   │
└─────────────────────────────┘
```

### 主な機能

- **短縮コマンド**: `/cl`（セッション一覧）、`/c <session>`（接続）
- **スレッドベース対話**: 各セッションを個別のスレッドで管理
- **リアルタイム差分送信**: コマンド実行中の進捗をリアルタイムで確認（500文字以上）
- **非同期処理**: タイムアウトなし、完了まで無限待機
- **スマート出力抽出**: ユーザープロンプト以降の関連出力のみを自動抽出
- **長時間処理対応**: 経過時間表示と動的更新頻度調整
- **自動分割**: 長い出力を自動的に複数メッセージに分割
- **スマホ対応**: 短いコマンドで快適に操作
- **完了判定**: 2回連続確認による安定した完了判定

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
# プロジェクトルートに.envファイルを作成
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
# すべての依存関係をインストール
npm install

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
✅ 完了 (3秒) - 送信メッセージ数: 1

📄 [最終 1]
[出力内容がここに表示されます]
```

## 📖 使い方

### 基本操作

1. `/cl` - tmuxセッション一覧を表示
2. `/c <session>` - セッションに接続（スレッドが自動作成）
3. スレッド内でメッセージ送信 - Claude Codeに命令を送信

### 機能詳細

#### リアルタイム差分送信

- 500文字以上の出力が溜まると自動的に差分送信
- `📄 [進行中 N]` マーカーで進捗を表示
- 完了時に `📄 [最終 N]` マーカーで最終出力を送信
- 処理中インジケータは自動的にフィルタリング

#### 非同期処理

- タイムアウトなし、完了まで無限待機
- 処理中は経過時間を表示（例: `🔄 処理中... ⏱️ 1分30秒`）
- 更新頻度は動的調整:
  - 最初の30秒: 2秒ごと
  - 30秒〜5分: 5秒ごと
  - 5分〜30分: 10秒ごと
  - 30分以上: 30秒ごと

#### スマート出力抽出

- ユーザープロンプト（`> `で始まる行）を自動検出
- その位置以降の関連出力のみを抽出
- 以下を自動的にフィルタリング:
  - 処理中インジケータ（✢、✻、∴等）
  - システムメッセージ（「Thinking…」「undefined…」）
  - 装飾線
  - 空のプロンプト行

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

### systemdでの運用

systemdサービスファイルを作成:

```bash
sudo nano /etc/systemd/system/slack-claude-bot.service
```

サービスファイルの内容:

```ini
[Unit]
Description=Slack Claude Code Bot (Tmux Integration)
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/slack-claude-code-integration
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/slack-bot/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=slack-claude-bot

[Install]
WantedBy=multi-user.target
```

サービスの起動と管理:

```bash
# サービスの有効化と起動
sudo systemctl enable slack-claude-bot.service
sudo systemctl start slack-claude-bot.service

# ステータス確認
sudo systemctl status slack-claude-bot.service

# ログ確認
sudo journalctl -u slack-claude-bot.service -f

# サービスの再起動
sudo systemctl restart slack-claude-bot.service
```

## ⚡ パフォーマンスチューニング

### メッセージ送信の最適化

現在の設定（`slack-bot/async-executor.ts`）:
- 差分送信の閾値: 500文字
- メッセージ分割サイズ: 2500文字

調整する場合:

```typescript
// 差分送信の閾値を変更
if (diff.length >= 300) {  // 500 → 300でより頻繁に送信
  // 差分送信
}

// 分割サイズを変更
const chunks = this.splitOutput(output, 3000);  // 2500 → 3000でより大きなチャンクに
```

### tmuxのパフォーマンス

`~/.tmux.conf`で履歴バッファを増やす:

```bash
set-option -g history-limit 50000
```

## 🔐 セキュリティベストプラクティス

### 認証情報の管理

1. **`.env`ファイルをGitにコミットしない**
   - `.gitignore`に追加
   - 本番環境では環境変数を使用

2. **トークンのローテーション**
   - Botトークンは90日ごとに再生成を推奨
   - トークンの使用状況を定期的に監視

3. **アクセス制限**
   - Botを特定のチャンネルのみに招待
   - センシティブな操作はプライベートチャンネルで実施
   - 必要に応じてユーザー許可リストを実装

### AWS セキュリティ（EC2デプロイ時）

```bash
# AWS Secrets Managerを使用
aws secretsmanager create-secret \
  --name slack-claude-bot \
  --secret-string file://.env

# IAMロールでEC2インスタンスのアクセスを制限
```

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

3. サービスのステータスを確認:
   ```bash
   sudo systemctl status slack-claude-bot.service
   # または
   pm2 status
   ```

### "No tmux sessions found"

```bash
# tmuxセッションを確認
tmux ls

# セッションが存在しない場合は作成
tmux new -s myproject
claude
```

### "出力が正しく表示されない"

出力抽出のログを確認:
```bash
# systemdログ
sudo journalctl -u slack-claude-bot.service -f | grep "Found user prompt"

# PM2ログ
pm2 logs slack-claude-bot | grep "Found user prompt"
```

### ログの確認

```bash
# systemd使用時
sudo journalctl -u slack-claude-bot.service -f

# PM2使用時
pm2 logs slack-claude-bot

# 直接実行時
tail -f app.log

# エラーログのみ
grep ERROR app.log
```

## ❓ よくある質問

### Q: 複数のユーザーが同時に使用できますか？

A: はい、可能です。各ユーザーがそれぞれ異なるtmuxセッションに接続すれば、並行して作業できます。

### Q: セッションが切断された場合はどうなりますか？

A: tmuxセッション自体は継続しているため、再度 `/c` コマンドで接続すれば作業を再開できます。

### Q: Claude Codeのコマンド履歴は保持されますか？

A: はい、tmuxセッションが存在する限り、Claude Codeの履歴は保持されます。

### Q: 長時間実行されるタスクはタイムアウトしますか？

A: いいえ、タイムアウトはありません。完了まで無限に待機し、経過時間を定期的に表示します。

### Q: 長い処理の進捗を確認できますか？

A: はい！リアルタイム差分送信機能により、出力が500文字以上溜まるごとに進捗を確認できます。

## 🏗️ プロジェクト構造

```
slack-claude-code-integration/
├── slack-bot/                # Slack Bot（tmuxベース）
│   ├── index.ts              # メインBot実装
│   ├── tmux-connector.ts     # tmux操作
│   ├── session-manager.ts    # セッション管理
│   ├── async-executor.ts     # 非同期実行・差分送信
│   └── package.json
├── dist/                     # TypeScriptビルド出力
├── .gitignore                # Git除外設定
├── .env.example              # 環境変数テンプレート
├── package.json              # ルートパッケージ定義
├── tsconfig.json             # TypeScript設定
└── README.md                 # このファイル
```

## 🤝 コントリビューション

プルリクエストを歓迎します！以下の手順に従ってください：

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

### 開発ガイドライン

- TypeScriptの厳格モードを使用
- ESLintルールに従う
- コミットメッセージは日本語または英語で明確に記述
- 新機能にはテストを追加

## 📝 変更履歴

### [2.0.0] - 2025-10-31

#### 追加
- リアルタイム差分送信機能（案1）
- 2回連続確認による安定した完了判定
- ユーザープロンプト位置の自動検出
- スマート出力フィルタリング（処理中インジケータ除去）
- デバッグ用の詳細ログ

#### 変更
- メッセージ長制限の対応（chat.update vs chat.postMessage）
- 出力抽出がユーザープロンプト（`> `）から開始するように変更

#### 修正
- 完了判定の誤検出（false positive）
- 過去の履歴を含む出力
- 空の出力メッセージ

### [1.0.0] - 2025-10-01

#### 追加
- 初回リリース
- tmuxベースのセッション管理
- ステータス更新付き非同期処理
- 動的更新頻度調整
- 長い出力の自動分割

## 📚 参考リンク

- [Slack Bolt Framework](https://slack.dev/bolt-js)
- [Claude Code CLI](https://claude.ai/code)
- [Slack API Documentation](https://api.slack.com/docs)
- [tmux Documentation](https://github.com/tmux/tmux/wiki)

## 📄 ライセンス

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 🙏 謝辞

このプロジェクトは、[Engineers Hub Ltd](https://github.com/engineers-hub) による元のMCPベース実装に基づいています。元の実装とインスピレーションに感謝を申し上げます。

**その他のクレジット:**
- [Claude Code](https://claude.ai/code) by Anthropic
- [Slack API](https://api.slack.com)
- [Node.js](https://nodejs.org)

---

**最終更新**: 2025年10月31日
