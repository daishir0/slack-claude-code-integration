# Slack → Claude Code 統合プロジェクト

SlackからClaude Codeを操作できる統合システムです。複数人の開発チームでClaude Codeを共有して使用できます。

## 🎯 概要

このプロジェクトは、SlackをインターフェースとしてClaude Codeを操作可能にします。MCP (Model Context Protocol)を使用してClaude CodeをサーバーとしてラップしSlack Botから接続します。

### アーキテクチャ

```
Slack → Slack Bot → Claude Code MCP Server → Claude Code CLI
```

### 主な機能

- **Slackメンション**: `@ClaudeBot` でClaude Codeを呼び出し
- **ダイレクトメッセージ**: BotとのDMでプライベートな作業
- **スラッシュコマンド**: `/claude` で素早くコマンド実行
- **マルチプロジェクト対応**: `--project` オプションで複数プロジェクトを切り替え
- **チーム共有**: 複数メンバーで同じClaude Code環境を利用

## 🚀 セットアップガイド

### 前提条件

- Node.js 22以上（推奨）またはNode.js 20以上
- npm または yarn
- TypeScript の基本的な知識（開発時）
- Claude Code CLIがインストール済み（`npm install -g @anthropic-ai/claude-code`）
- Slack Workspace管理者権限
- Docker & Docker Compose（オプション）

### Step 1: Slack App作成と設定

#### 1-1. 新しいSlack Appを作成

1. https://api.slack.com/apps にアクセス
2. **"Create New App"** をクリック
3. **"From scratch"** を選択
4. App名（例: `Claude Code Bot`）とWorkspaceを選択
5. **"Create App"** をクリック

#### 1-2. Socket Modeを有効化

1. 左側メニューから **"Socket Mode"** を選択
2. **"Enable Socket Mode"** をONに切り替え
3. App Level Tokenの生成ポップアップが表示される

#### 1-3. App Level Tokenを生成

1. Token Nameに任意の名前を入力（例: `socket-token`）
2. **"Add Scope"** ボタンをクリック
3. **`connections:write`** を選択
4. **"Generate"** ボタンをクリック
5. 生成されたトークン（`xapp-1-...`）をコピーして保存

#### 1-4. OAuth & Permissionsの設定

1. 左側メニューから **"OAuth & Permissions"** を選択
2. **"Scopes"** セクションまでスクロール
3. **"Bot Token Scopes"** で **"Add an OAuth Scope"** をクリック
4. 以下のスコープを追加:
   - `app_mentions:read` - メンションを読み取る
   - `chat:write` - メッセージを送信する
   - `chat:write.public` - パブリックチャンネルに送信
   - `commands` - スラッシュコマンドを受信
   - `im:history` - DMの履歴を読む
   - `im:read` - DMを読む
   - `im:write` - DMを送信する
   - `users:read` - ユーザー情報を読む（オプション）

#### 1-5. Event Subscriptionsの設定

1. 左側メニューから **"Event Subscriptions"** を選択
2. **"Enable Events"** をONに切り替え
3. Request URLは Socket Mode使用のため設定不要
4. **"Subscribe to bot events"** セクションで以下を追加:
   - `app_mention` - @メンションイベント
   - `message.im` - ダイレクトメッセージイベント
5. **"Save Changes"** をクリック

#### 1-6. Slash Commandsの設定

1. 左側メニューから **"Slash Commands"** を選択
2. **"Create New Command"** をクリック
3. 以下の情報を入力:
   - **Command**: `/claude`
   - **Request URL**: `https://example.com` (Socket Modeでは使用されない)
   - **Short Description**: `Claude Codeアシスタント`
   - **Usage Hint**: `[タスクの説明] [--project /path/to/project]`
4. **"Save"** をクリック

#### 1-7. App Manifestの確認（オプション）

1. 左側メニューから **"App Manifest"** を選択
2. 設定が正しく反映されているか確認

#### 1-8. ワークスペースにインストール

1. 左側メニューから **"Install App"** を選択
2. **"Install to Workspace"** ボタンをクリック
3. 権限の確認画面で **"許可する"** をクリック
4. **Bot User OAuth Token** (`xoxb-...`) をコピーして保存

#### 1-9. Basic Informationから認証情報を取得

1. 左側メニューから **"Basic Information"** を選択
2. **"App Credentials"** セクションから以下をコピー:
   - **Signing Secret**: アプリの署名シークレット

### Step 2: プロジェクトのセットアップ

#### 2-1. リポジトリのクローン

```bash
# GitHubからクローン（または直接ダウンロード）
git clone https://github.com/your-org/slack-claude-code-integration.git
cd slack-claude-code-integration

# またはプロジェクトディレクトリを直接使用
cd /home/yusuke/engineers-hub.ltd/in-house-project/slack-claude-code-integration
```

#### 2-2. 環境変数の設定

```bash
# .env.exampleから.envファイルを作成
cp .env.example .env

# .envファイルを編集
nano .env  # またはお好みのエディタで編集
```

**.envファイルの内容:**

```env
# Slack App認証情報（Step 1で取得した値を設定）
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here

# Claude Code設定
CLAUDE_PATH=claude  # Claude CLIのパス（通常はこのまま）
PROJECT_PATH=/home/yusuke/your-project  # デフォルトで操作するプロジェクトのパス

# デバッグ設定
DEBUG=true  # 開発時はtrueに設定
```

#### 2-3. Claude Code CLIの確認

```bash
# Claude CLIがインストールされているか確認
which claude

# インストールされていない場合
npm install -g @anthropic-ai/claude-code

# 認証が完了しているか確認
claude --version
```

### Step 3: 依存関係のインストール

```bash
# ルートディレクトリで実行
npm run setup

# TypeScriptをビルド
npm run build

# または個別にインストール
npm install  # ルートディレクトリ
cd claude-code-mcp && npm install && cd ..
cd slack-bot && npm install && cd ..
npm run build  # TypeScriptをビルド
```

### Step 4: アプリケーションの起動

#### 4-1. ローカル実行（開発環境）

```bash
# 開発モードで起動（TypeScript自動ビルド + ホットリロード付き）
npm run dev

# または個別に起動
# ターミナル1: TypeScriptウォッチモード
npm run build:watch

# ターミナル2: MCPサーバー
npm run start:mcp

# ターミナル3: Slack Bot
npm run start:bot
```

**正常起動時の出力例:**

```
> slack-claude-code-integration@1.0.0 dev
> npm run build && concurrently "npm run build:watch" "npm run start:mcp" "npm run start:bot"

[0] TypeScript compilation complete
[1] Watching for file changes...
[2] [MCP] Claude Code MCP Server started
[2] [MCP] Claude path: claude
[2] [MCP] Project path: /home/yusuke/your-project
[3] Connecting to Claude Code MCP Server...
[3] Connected to Claude Code MCP Server
[3] Available tools: [ { name: 'claude_code', ... } ]
[3] ⚡️ Slack Claude Code Bot is running!
[3] Project path: /home/yusuke/your-project
```

#### 4-2. Docker実行（本番環境推奨）

```bash
# Dockerイメージをビルド
npm run docker:build

# または
docker-compose build

# サービスを起動
npm run docker:up

# または
docker-compose up -d

# ログを確認
docker-compose logs -f

# 停止
npm run docker:down
```

### Step 5: アプリケーションの動作確認

#### 5-1. 起動確認

正常に起動すると以下のようなログが表示されます：

```
[MCP] Claude Code MCP Server started
[MCP] Claude path: claude
[MCP] Project path: /home/yusuke/engineers-hub.ltd/in-house-project
Connecting to Claude Code MCP Server...
Connected to Claude Code MCP Server
Available tools: [
  {
    "name": "claude_code",
    "description": "Execute Claude Code commands in a project directory",
    "inputSchema": { ... }
  }
]
[INFO]  socket-mode:SocketModeClient:0 Going to establish a new connection to Slack ...
⚡️ Slack Claude Code Bot is running!
Project path: /home/yusuke/engineers-hub.ltd/in-house-project
🧪 Running in TEST MODE - using echo commands
[INFO]  socket-mode:SocketModeClient:0 Now connected to Slack
```

#### 5-2. 動作モード

**テストモード（デフォルト）:**

- `TEST_MODE=true` の場合、実際のClaude Codeではなく`echo`コマンドでシミュレーション
- 安全に動作確認ができる
- 例: 入力「ファイルをリストして」→ 出力「Claude would execute: "ファイルをリストして" in /path/to/project」

**本番モード:**

- `TEST_MODE=false` に設定すると実際のClaude Codeが実行される
- 実際のファイル操作やコード変更が可能

#### 5-3. テストモードから本番モードへの切り替え

**方法1: 環境変数で設定（推奨）**

```bash
# アプリケーションを停止（Ctrl+C）してから
# .env ファイルに追加
echo "TEST_MODE=false" >> .env

# または直接編集
nano .env
# TEST_MODE=false を追加

# アプリケーションを再起動
./start-test.sh
```

**方法2: 起動スクリプトを編集**

```bash
# start-test.sh を編集
export TEST_MODE=false  # true から false に変更
```

**方法3: コード内で直接設定**

```javascript
// slack-bot/index.js の 263行目付近
process.env.TEST_MODE = 'false'; // 'true' から 'false' に変更
```

### Step 6: Slackでのテストと利用開始

#### 6-1. Botをチャンネルに招待

1. Slackでテストしたいチャンネルを開く
2. 以下のコマンドを入力:
   ```
   /invite @Claude Code Bot
   ```
   （Bot名は作成時に設定した名前）

#### 6-2. 初回テスト

**ヘルプメッセージ:**

```
@Claude Code Bot help
```

**応答例:**

```
こんにちは！Claude Codeコマンドを実行できます。

使い方:
```

@ClaudeBot <あなたの指示>
@ClaudeBot <あなたの指示> --project /path/to/project

```

例:
• @ClaudeBot このプロジェクトのテストを実行して
• @ClaudeBot package.jsonの内容を確認して
• @ClaudeBot src/index.jsのバグを修正して
```

#### 6-3. テストモードでの動作確認

**ファイルリスト取得（テストモード）:**

```
@Claude Code Assistant ファイルをリストして
```

**応答（テストモード）:**

```
Claude would execute: "ファイルをリストして" in /home/yusuke/engineers-hub.ltd/in-house-project
```

**⚠️ 注意**: Bot名は実際に設定した名前（例: `@Claude Code Assistant`）に置き換えてください。

#### 6-4. 本番モードでの実際の使用例

**プロジェクト構造の確認:**

```
@Claude Code Bot このプロジェクトの構造を教えて
```

**ファイルの確認:**

```
@Claude Code Bot package.jsonの内容を確認して
```

**コードの修正:**

```
@Claude Code Bot src/index.js のエラーを修正して
```

**テストの実行:**

```
@Claude Code Bot テストを実行して結果を教えて
```

**別プロジェクトでの実行:**

```
@Claude Code Bot ビルドを実行して --project /home/user/another-project
```

### Step 7: アプリケーションの管理

#### 7-1. アプリケーションの起動

**開発環境での起動:**

```bash
# シンプルな起動
cd /path/to/slack-claude-code-integration
npm run dev

# テストモードで起動
./start-test.sh

# バックグラウンドで起動
nohup npm run dev > app.log 2>&1 &
```

**本番環境での起動（systemdサービス例）:**

```ini
# /etc/systemd/system/slack-claude-bot.service
[Unit]
Description=Slack Claude Code Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/slack-claude-code-integration
Environment="NODE_ENV=production"
Environment="TEST_MODE=false"
ExecStartPre=/usr/bin/npm run build
ExecStart=/usr/bin/node dist/slack-bot/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 7-2. プロセス管理

**PM2を使用した管理（推奨）:**

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

# 停止
pm2 stop slack-claude-bot

# 自動起動設定
pm2 startup
pm2 save
```

#### 7-3. ログ管理

**ログファイルの確認:**

```bash
# PM2使用時
pm2 logs slack-claude-bot --lines 100

# 直接実行時
tail -f app.log

# エラーログのみ
grep ERROR app.log

# MCPサーバーのログ
grep "\[MCP\]" app.log
```

**ログローテーション設定:**

```bash
# /etc/logrotate.d/slack-claude-bot
/path/to/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 user group
}
```

## 📖 詳細な使い方

### 3つの利用方法

#### 1. メンション（チャンネル内での利用）

チャンネル内で `@Claude Code Bot` をメンションして使用:

```
@Claude Code Bot テストを実行して結果を教えて
@Claude Code Bot src/components/Button.tsx のバグを修正して
@Claude Code Bot 新機能のブランチを作成して
@Claude Code Bot このプロジェクトのREADMEを改善して
```

**メリット:**

- チーム全員が作業内容を確認できる
- 履歴が残り、知識共有になる
- スレッドで議論を続けられる

#### 2. ダイレクトメッセージ（プライベートな作業）

BotとのDMで個人的な作業:

```
テストを実行して
README.mdを更新して
バグを見つけて修正して
コードレビューをして
```

**メリット:**

- 試行錯誤を他の人に見せずに作業
- 個人的な学習や実験に最適
- チャンネルを汚さない

#### 3. スラッシュコマンド（素早い実行）

どこからでも `/claude` コマンドで実行:

```
/claude run tests
/claude fix the bug in auth.js
/claude analyze performance issues
/claude create unit tests for user.service.ts
```

**メリット:**

- 最も素早く実行できる
- どのチャンネルからでも使える
- 実行結果は自分だけに表示（他の人には見えない）

### プロジェクトの切り替え

#### デフォルトプロジェクト

`.env`で設定した`PROJECT_PATH`がデフォルトで使用されます:

```
@Claude Code Bot パッケージをアップデートして
```

#### 別プロジェクトの指定

`--project`オプションで他のプロジェクトを操作:

```
@Claude Code Bot ビルドエラーを修正して --project /home/user/web-app
@Claude Code Bot テストを実行 --project /home/user/api-server
/claude analyze code quality --project /home/projects/mobile-app
```

### 実践的な使用例

#### 開発ワークフロー

**1. 朝のプロジェクト状態確認:**

```
@Claude Code Bot 昨日からの変更点をまとめて
@Claude Code Bot CIの状態を確認して
```

**2. 機能開発:**

```
@Claude Code Bot feature/user-authブランチを作成して
@Claude Code Bot ユーザー認証のAPIエンドポイントを実装して
@Claude Code Bot 実装したコードのテストを書いて
```

**3. バグ修正:**

```
@Claude Code Bot production.logの最新のエラーを分析して
@Claude Code Bot エラーの原因を特定して修正案を提示して
@Claude Code Bot 修正を適用してテストを実行して
```

**4. コードレビュー:**

```
@Claude Code Bot 最新のコミットをレビューして
@Claude Code Bot セキュリティの観点でコードをチェックして
@Claude Code Bot パフォーマンスの改善点を提案して
```

**5. ドキュメント作成:**

```
@Claude Code Bot APIドキュメントを生成して
@Claude Code Bot 新機能の使い方をREADMEに追加して
@Claude Code Bot コメントを日本語から英語に翻訳して
```

#### チーム協働シナリオ

**シナリオ1: バグ報告と修正**

```
開発者A: @Claude Code Bot ユーザー登録でエラーが発生している。原因を調査して
Claude: [エラーログと原因を分析]
開発者B: @Claude Code Bot その修正を実装してPRを作成して
Claude: [修正を実装し、PR作成]
```

**シナリオ2: 新機能の実装**

```
PM: @Claude Code Bot 検索機能の要件を整理して実装計画を立てて
Claude: [要件整理と実装計画を提示]
開発者: @Claude Code Bot その計画に従って基本実装を進めて
Claude: [実装を進める]
```

## 🔧 詳細設定

### 環境変数

#### 必須の環境変数

| 変数名               | 説明                            | 取得場所                                         | 例                        |
| -------------------- | ------------------------------- | ------------------------------------------------ | ------------------------- |
| SLACK_BOT_TOKEN      | Bot User OAuth Token            | Slack App → Install App                          | `xoxb-1234567890123-...`  |
| SLACK_SIGNING_SECRET | アプリの署名シークレット        | Slack App → Basic Information                    | `abc123def456...`         |
| SLACK_APP_TOKEN      | App-Level Token (Socket Mode用) | Slack App → Basic Information → App-Level Tokens | `xapp-1-A01234567890-...` |
| PROJECT_PATH         | デフォルトプロジェクトパス      | ローカルのプロジェクトパス                       | `/home/user/my-project`   |

#### オプションの環境変数

| 変数名      | 説明                                | デフォルト値 | 例                      |
| ----------- | ----------------------------------- | ------------ | ----------------------- |
| CLAUDE_PATH | Claude CLIの実行パス                | `claude`     | `/usr/local/bin/claude` |
| DEBUG       | デバッグログの出力                  | `false`      | `true`                  |
| MCP_PORT    | MCPサーバーのポート（将来の拡張用） | `3001`       | `3002`                  |

### 高度な設定

#### 複数プロジェクトの管理

**方法1: 環境変数で複数プロジェクトを定義**

```env
# .env
PROJECT_PATH=/home/user/main-project
PROJECT_WEB=/home/user/web-app
PROJECT_API=/home/user/api-server
PROJECT_MOBILE=/home/user/mobile-app
```

**方法2: プロジェクト設定ファイル（開発中の機能）**

```json
// projects.json
{
  "projects": {
    "main": "/home/user/main-project",
    "web": "/home/user/web-app",
    "api": "/home/user/api-server",
    "mobile": "/home/user/mobile-app"
  },
  "default": "main"
}
```

#### チーム別の設定

複数チームで異なるプロジェクトを管理する場合:

```bash
# チームA用の設定
cp .env.example .env.team-a
# PROJECT_PATH=/projects/team-a

# チームB用の設定
cp .env.example .env.team-b
# PROJECT_PATH=/projects/team-b

# 起動時に設定を指定
NODE_ENV=team-a npm run dev
```

#### セキュリティ設定

**アクセス制限の実装例（slack-bot/index.ts をカスタマイズ）:**

```typescript
// 特定のユーザーのみ許可
const ALLOWED_USERS: string[] = ['U1234567890', 'U0987654321'];

// 特定のチャンネルのみ許可
const ALLOWED_CHANNELS: string[] = ['C1234567890', 'C0987654321'];

// 特定のプロジェクトパスのみ許可
const ALLOWED_PROJECTS: string[] = ['/home/user/safe-project-1', '/home/user/safe-project-2'];
```

## 🏗️ プロジェクト構造

```
slack-claude-code-integration/
├── claude-code-mcp/          # Claude Code MCPサーバー
│   ├── index.ts             # MCPサーバー実装 (TypeScript)
│   ├── package.json         # 依存関係定義
│   ├── Dockerfile           # Dockerイメージ定義
│   └── .env.example         # 環境変数サンプル
├── slack-bot/               # Slack Bot
│   ├── index.ts            # Bot実装 (TypeScript)
│   ├── package.json        # 依存関係定義
│   ├── Dockerfile          # Dockerイメージ定義
│   └── .env.example        # 環境変数サンプル
├── scripts/                 # ユーティリティスクリプト
│   ├── setup.sh            # セットアップスクリプト
│   └── post-build.sh       # ビルド後処理スクリプト
├── dist/                    # TypeScriptビルド出力（Git管理外）
├── docker/                  # Docker関連ファイル（将来の拡張用）
├── docker-compose.yml       # Docker Compose設定
├── package.json            # ルートパッケージ定義
├── tsconfig.json           # TypeScript設定
├── eslint.config.js        # ESLint設定 (TypeScript対応)
├── lefthook.yml            # Gitフック設定
├── .env.example            # 環境変数サンプル
├── .gitignore              # Git除外設定
├── CLAUDE.md               # Claude Code向けガイダンス
└── README.md               # このファイル
```

### 各コンポーネントの役割

- **claude-code-mcp**: Claude CodeをMCPプロトコルでラップし、外部からアクセス可能にする
- **slack-bot**: SlackイベントをMCP経由でClaude Codeに転送し、結果を返す
- **scripts**: セットアップや運用を支援するスクリプト群

## 🔐 セキュリティ考慮事項

### 1. 認証情報の管理

**必須事項:**

- `.env`ファイルは**絶対に**Gitにコミットしない（`.gitignore`に含まれています）
- 本番環境では環境変数を使用（Docker Secrets、AWS Secrets Manager等）
- トークンは定期的にローテーション

**ベストプラクティス:**

```bash
# 開発環境
cp .env.example .env.development
# 本番環境
cp .env.example .env.production

# Git管理から除外を確認
git check-ignore .env
```

### 2. アクセス制限

**Slackレベルの制限:**

- Botを特定のチャンネルのみに招待
- プライベートチャンネルでの利用を推奨
- 必要に応じてユーザーリストでフィルタリング

**アプリケーションレベルの制限:**

```typescript
// slack-bot/index.ts に追加可能なセキュリティチェック
const ALLOWED_USERS: string[] = process.env.ALLOWED_USERS?.split(',') || [];
const ALLOWED_CHANNELS: string[] = process.env.ALLOWED_CHANNELS?.split(',') || [];

// イベントハンドラー内で検証
if (ALLOWED_USERS.length && !ALLOWED_USERS.includes(event.user)) {
  return; // 許可されていないユーザー
}
```

### 3. プロジェクトアクセス制限

**ディレクトリトラバーサル対策:**

```javascript
// 安全なパス検証
const path = require('path');
const safePath = path.resolve(projectPath);
if (!safePath.startsWith('/allowed/base/path')) {
  throw new Error('Access denied');
}
```

**読み取り専用モード（実装例）:**

```javascript
// 特定のコマンドのみ許可
const SAFE_COMMANDS = ['list', 'read', 'analyze', 'test'];
```

### 4. Claude認証の保護

- Claude APIキーは環境変数で管理
- Claude CLIの認証情報（`~/.config/claude/`）は適切な権限で保護
- Dockerイメージには認証情報を含めない

## 🧪 テストとデバッグ

### ユニットテスト

**MCPサーバーのテスト:**

```bash
cd claude-code-mcp
npm test  # 現在は未実装

# TypeScriptの型チェック
npm run build

# 手動テスト（ビルド後）
node ../dist/claude-code-mcp/index.js
```

**Slack Botのテスト:**

```bash
cd slack-bot
npm test  # 現在は未実装

# TypeScriptの型チェック
npm run build

# デバッグモードで起動（ビルド後）
DEBUG=true node ../dist/slack-bot/index.js
```

### 統合テスト

**ローカル環境での統合テスト:**

```bash
# 1. MCPサーバーを起動
cd claude-code-mcp && npm start

# 2. 別ターミナルでSlack Botを起動
cd slack-bot && npm start

# 3. Slackでテストメッセージを送信
```

### デバッグ方法

**ログレベルの設定:**

```env
# .env
DEBUG=true
LOG_LEVEL=debug  # error, warn, info, debug
```

**一般的なデバッグコマンド:**

```bash
# プロセスの確認
ps aux | grep node

# ポートの確認
netstat -tlnp | grep 3001

# ログの確認
tail -f npm-debug.log
```

## 🚨 トラブルシューティング

### 起動時の問題

#### "Claude command not found"

```bash
# Claude CLIの場所を確認
which claude
# 見つからない場合はインストール
npm install -g @anthropic-ai/claude-code

# パスを明示的に指定
export CLAUDE_PATH=/usr/local/bin/claude
# または.envファイルで設定
echo "CLAUDE_PATH=/usr/local/bin/claude" >> .env
```

#### "Cannot connect to MCP Server"

```bash
# MCPサーバーが起動しているか確認
ps aux | grep "claude-code-mcp"

# ログを確認
cd claude-code-mcp && npm start
# エラーメッセージを確認

# ファイアウォールの確認
sudo iptables -L | grep 3001
```

#### "AppInitializationError: You must provide an appToken"

```
エラー: AppInitializationError: You must provide an appToken when socketMode is set to true
```

**解決方法:**

1. `.env`ファイルが正しい場所にあるか確認
2. 環境変数が正しく設定されているか確認:
   ```bash
   cat .env | grep SLACK_APP_TOKEN
   ```
3. トークンの前後に空白がないか確認

#### "MCP error -32000: Connection closed"

```
エラー: McpError: MCP error -32000: Connection closed
```

**解決方法:**

1. Node.jsのバージョンを確認（22以上推奨）:
   ```bash
   node --version
   ```
2. 依存関係を再インストール:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Slack接続の問題

#### "Socket Mode connection failed"

1. **Socket Modeの確認:**
   - Slack App管理画面 → Socket Mode → Enable Socket Mode がON
2. **App Tokenの確認:**
   - スコープに`connections:write`が含まれているか
   - トークンが正しくコピーされているか（前後の空白に注意）

3. **ネットワークの確認:**
   ```bash
   # WebSocket接続のテスト
   curl -I https://slack.com
   ```

#### "Bot is not responding"

1. **Botの招待確認:**

   ```
   /invite @Claude Code Bot
   ```

2. **イベント購読の確認:**
   - Event Subscriptions → Subscribe to bot events
   - `app_mention`と`message.im`が追加されているか

3. **権限の確認:**
   - OAuth & Permissions → Bot Token Scopes
   - 必要なスコープがすべて追加されているか

### 実行時の問題

#### "No response from Claude Code"

```bash
# Claude CLIが動作するか直接確認
claude --version

# 手動でコマンドを実行
cd /your/project/path
claude "list files"

# 環境変数の確認
env | grep -E "(CLAUDE|PROJECT)"
```

#### "Permission denied"

```bash
# プロジェクトディレクトリの権限確認
ls -la /path/to/project

# Dockerの場合、ボリュームマウントの確認
docker exec -it slack-claude-bot ls -la /workspace
```

#### テストモードの動作確認

**問題:** 実際のClaude Codeが実行されない

**確認事項:**

1. テストモードが有効になっているか確認:

   ```bash
   # ログを確認
   grep "TEST MODE" app.log
   ```

2. テストモードの出力例:

   ```
   入力: "ファイルをリストして"
   出力: "Claude would execute: \"ファイルをリストして\" in /path/to/project"
   ```

3. 本番モードに切り替える場合は、`TEST_MODE=false`を設定

### パフォーマンスの問題

#### 応答が遅い

1. **リソースの確認:**

   ```bash
   # CPU/メモリ使用率
   top -p $(pgrep -f claude)

   # ディスク容量
   df -h
   ```

2. **並行処理の制限:**
   ```javascript
   // 同時実行数を制限（実装例）
   const queue = new Queue({ concurrency: 2 });
   ```

### ログの確認方法

**アプリケーションログ:**

```bash
# Slack Botのログ
journalctl -u slack-claude-bot -f

# Dockerの場合
docker-compose logs -f slack-bot
docker-compose logs -f claude-code-mcp
```

**デバッグ用の詳細ログ:**

```bash
# DEBUG環境変数を有効化
DEBUG=true npm run dev

# MCPサーバーのログを別ウィンドウで確認
cd claude-code-mcp && DEBUG=true node index.js
```

**Slackのイベントログ:**

- Slack App管理画面 → Event Subscriptions → Recent Events

**Claude Codeのログ:**

```bash
# Claude CLIのログ位置を確認
claude --help | grep -i log
```

### よくある設定ミス

#### 環境変数の設定ミス

```bash
# よくある間違い
SLACK_BOT_TOKEN="xoxb-..."  # ダブルクォート不要
SLACK_BOT_TOKEN= xoxb-...    # 先頭の空白

# 正しい設定
SLACK_BOT_TOKEN=xoxb-...
```

#### パスの設定ミス

```bash
# よくある間違い
PROJECT_PATH=~/my-project     # チルダは展開されない
PROJECT_PATH=./my-project     # 相対パス

# 正しい設定
PROJECT_PATH=/home/user/my-project  # 絶対パス
```

## 📊 運用とモニタリング

### ヘルスチェック

**簡易ヘルスチェックスクリプト:**

```bash
#!/bin/bash
# scripts/health-check.sh

# MCPサーバーの確認
if pgrep -f "claude-code-mcp" > /dev/null; then
    echo "✅ MCP Server is running"
else
    echo "❌ MCP Server is down"
fi

# Slack Botの確認
if pgrep -f "slack-bot" > /dev/null; then
    echo "✅ Slack Bot is running"
else
    echo "❌ Slack Bot is down"
fi

# Claude CLIの確認
if command -v claude &> /dev/null; then
    echo "✅ Claude CLI is available"
else
    echo "❌ Claude CLI not found"
fi
```

### メトリクス収集（実装例）

```javascript
// metrics.js
const prometheus = require('prom-client');

// カスタムメトリクス
const commandCounter = new prometheus.Counter({
  name: 'claude_commands_total',
  help: 'Total number of Claude commands executed',
  labelNames: ['command_type', 'project', 'user']
});

const responseTime = new prometheus.Histogram({
  name: 'claude_response_duration_seconds',
  help: 'Claude command response time',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});
```

### ログ管理

**構造化ログの実装例:**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

## 🚀 スケーリングと高度な設定

### 水平スケーリング

**複数インスタンスの実行:**

```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  slack-bot:
    deploy:
      replicas: 3
    environment:
      - INSTANCE_ID={{.Task.Slot}}
```

### キューイングシステムの追加

**Redis Queueの実装例:**

```typescript
import Queue from 'bull';

interface ClaudeJob {
  prompt: string;
  projectPath: string;
  userId: string;
}

const claudeQueue = new Queue<ClaudeJob>('claude-commands', 'redis://localhost:6379');

// ジョブの追加
claudeQueue.add('execute', {
  prompt: userPrompt,
  projectPath: projectPath,
  userId: event.user
});

// ワーカー
claudeQueue.process('execute', async (job) => {
  const { prompt, projectPath } = job.data;
  return await claudeClient.executeCommand(prompt, projectPath);
});
```

### 負荷分散

**プロジェクト別のワーカー:**

```typescript
// 特定プロジェクト専用のワーカー
interface ProjectWorkers {
  [key: string]: ClaudeWorker;
}

const projectWorkers: ProjectWorkers = {
  'web-app': new ClaudeWorker({ project: '/projects/web-app' }),
  'api-server': new ClaudeWorker({ project: '/projects/api-server' }),
  'mobile-app': new ClaudeWorker({ project: '/projects/mobile-app' })
};
```

## 🔧 カスタマイズ例

### カスタムコマンドの追加

```typescript
// custom-commands.ts
interface CustomCommandArgs {
  environment?: string;
  projectPath: string;
  prNumber?: number;
}

const customCommands = {
  deploy: async (args: CustomCommandArgs) => {
    // デプロイメントロジック
    return await claudeClient.executeCommand(
      `deploy the application to ${args.environment}`,
      args.projectPath
    );
  },

  review: async (args: CustomCommandArgs) => {
    // コードレビューロジック
    return await claudeClient.executeCommand(
      `review the pull request #${args.prNumber}`,
      args.projectPath
    );
  }
};
```

### Slack UI の拡張

**インタラクティブメッセージ:**

```javascript
// ボタン付きメッセージ
await client.chat.postMessage({
  channel: event.channel,
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Claude Codeで実行するアクションを選択してください:'
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'テスト実行' },
          action_id: 'run_tests'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'ビルド' },
          action_id: 'build'
        }
      ]
    }
  ]
});
```

### 外部サービス連携

**GitHub連携の例:**

```javascript
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// PRコメントに結果を投稿
async function postResultToGitHub(prNumber, result) {
  await octokit.issues.createComment({
    owner: 'your-org',
    repo: 'your-repo',
    issue_number: prNumber,
    body: `Claude Code実行結果:\n\`\`\`\n${result}\n\`\`\``
  });
}
```

## 📚 詳細ドキュメントとリソース

### 公式ドキュメント

- [MCP (Model Context Protocol)仕様](https://modelcontextprotocol.com)
- [Slack Bolt Framework](https://slack.dev/bolt-js)
- [Claude Code CLI](https://claude.ai/code)
- [Slack API Documentation](https://api.slack.com/docs)

### 関連プロジェクト

- [steipete/claude-code-mcp](https://github.com/steipete/claude-code-mcp) - Claude Code MCP実装の参考
- [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) - MCP TypeScript SDK

### コミュニティリソース

- [Claude Discord Community](https://discord.gg/claude)
- [Slack Developer Community](https://community.slack.com)
- [MCP Implementations Gallery](https://modelcontextprotocol.com/gallery)

## 🤝 貢献ガイドライン

### 貢献の方法

1. **Issueの作成**
   - バグ報告
   - 機能要望
   - 質問

2. **プルリクエスト**

   ```bash
   # フォークしてクローン
   git clone https://github.com/your-username/slack-claude-code-integration.git

   # フィーチャーブランチを作成
   git checkout -b feature/amazing-feature

   # 変更をコミット
   git add .
   git commit -m 'feat: Add amazing feature'

   # プッシュ
   git push origin feature/amazing-feature
   ```

3. **コーディング規約**
   - TypeScriptの型定義を必須とする
   - ESLint設定に従う（TypeScript対応）
   - コミットメッセージは[Conventional Commits](https://www.conventionalcommits.org/)形式
   - テストを追加する

### 開発環境のセットアップ

```bash
# 開発用依存関係のインストール
npm install --save-dev typescript @types/node eslint prettier jest @types/jest

# TypeScriptのビルド
npm run build

# リンターの実行（TypeScript対応）
npm run lint

# フォーマッターの実行
npm run format

# テストの実行
npm test
```

## 🗺️ ロードマップ

### v1.1.0（計画中）

- [ ] Web UIダッシュボード
- [ ] 複数ワークスペース対応
- [ ] カスタムコマンドプラグインシステム
- [ ] 実行履歴の永続化

### v1.2.0（構想中）

- [ ] AIペアプログラミングモード
- [ ] 自動コードレビュー機能
- [ ] CI/CD統合
- [ ] メトリクスダッシュボード

### v2.0.0（将来）

- [ ] マルチモーダル対応（画像・動画）
- [ ] 音声コマンド対応
- [ ] エンタープライズ機能

## 📄 ライセンス

このプロジェクトはMIT Licenseの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

```
MIT License

Copyright (c) 2025 Engineers Hub Ltd

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 謝辞

このプロジェクトは以下の素晴らしいプロジェクトとコミュニティのおかげで実現しました：

- [Claude Code](https://claude.ai/code) by Anthropic - 革新的なAIコーディングアシスタント
- [Model Context Protocol](https://modelcontextprotocol.com) - AI統合の新しい標準
- [Slack API](https://api.slack.com) - 強力なコラボレーションプラットフォーム
- [Node.js](https://nodejs.org) - JavaScriptランタイム
- [Docker](https://www.docker.com) - コンテナ化プラットフォーム

特別な感謝：

- Claude Codeチーム（Anthropic）
- MCPコミュニティ
- 全てのコントリビューターとテスター

---

**🚀 Engineers Hub Ltd** - Building the future of AI-powered development

_最終更新: 2025年6月_

**お問い合わせ:**

- 🐛 Issues: [GitHub Issues](https://github.com/engineers-hub/slack-claude-code-integration/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/engineers-hub/slack-claude-code-integration/discussions)
