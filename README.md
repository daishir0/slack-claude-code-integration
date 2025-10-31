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
git clone https://github.com/yourusername/slack-claude-code-integration.git
cd slack-claude-code-integration
```

#### 2-2. 環境変数の設定

```bash
# .envファイルを作成
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

# Claude Configuration
CLAUDE_PATH=claude
PROJECT_PATH=/path/to/your/default/project

# Debug Mode
DEBUG=false

# Test Mode (false = use real Claude Code, true = use echo for testing)
TEST_MODE=false
```

#### 2-3. 依存関係のインストール

```bash
# ルートディレクトリで実行
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
| CLAUDE_PATH          | Claude CLIの実行パス       | `claude`                   |
| PROJECT_PATH         | デフォルトプロジェクトパス | `/home/user/myproject`     |
| DEBUG                | デバッグログの出力         | `false`                    |
| TEST_MODE            | テストモード               | `false`                    |

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
├── .env.example              # 環境変数サンプル
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

- [Claude Code](https://claude.ai/code) by Anthropic
- [Slack API](https://api.slack.com)
- [Node.js](https://nodejs.org)

---

**最終更新**: 2025年10月
