import { App, SlackEventMiddlewareArgs, SlackCommandMiddlewareArgs } from '@slack/bolt';
import * as path from 'path';
import { config } from 'dotenv';
import { TmuxConnector, TmuxSession } from './tmux-connector';
import { SessionManager } from './session-manager';
import { AsyncExecutor } from './async-executor';

// Load environment variables
config({ path: path.join(__dirname, '..', '..', '.env') });

// Type definitions
interface SlackMessageEvent {
  type: 'message';
  text?: string;
  channel: string;
  channel_type?: string;
  ts: string;
  thread_ts?: string;
  user: string;
}

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// Initialize tmux connector and session manager
const tmuxConnector = new TmuxConnector();
const sessionManager = new SessionManager('./session-mapping.json');
const asyncExecutor = new AsyncExecutor(tmuxConnector);

// Helper function to format session list
function formatSessionList(sessions: TmuxSession[]): string {
  if (sessions.length === 0) {
    return '📋 利用可能なtmuxセッションがありません';
  }

  let text = '📋 *利用可能なtmuxセッション:*\n\n';
  sessions.forEach((session, index) => {
    text += `${index + 1}: \`${session.name}\` (${session.windows} windows)\n`;
  });
  text += `\n使い方: \`/c <番号または名前>\` でセッションに接続`;

  return text;
}

// Handle /cl command (list sessions)
app.command('/cl', async ({ ack, respond }: SlackCommandMiddlewareArgs) => {
  await ack();

  try {
    const sessions = await tmuxConnector.listSessions();
    await respond({
      text: formatSessionList(sessions)
    });
  } catch (error) {
    console.error('Error listing tmux sessions:', error);
    await respond({
      text: `❌ tmuxセッションの取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Handle /c command (connect to session)
app.command('/c', async ({ command, ack, respond }: SlackCommandMiddlewareArgs) => {
  await ack();

  try {
    const args = command.text.trim();

    if (!args) {
      await respond({
        text: `*使い方:* \`/c <セッション番号または名前>\`\n\nセッション一覧を見るには \`/cl\` を使用してください`
      });
      return;
    }

    // セッション番号または名前を取得
    const sessions = await tmuxConnector.listSessions();

    if (sessions.length === 0) {
      await respond({
        text: '❌ 利用可能なtmuxセッションがありません'
      });
      return;
    }

    // 番号で指定された場合
    let targetSession: string | null = null;
    const sessionNumber = parseInt(args, 10);

    if (!isNaN(sessionNumber) && sessionNumber > 0 && sessionNumber <= sessions.length) {
      targetSession = sessions[sessionNumber - 1].name;
    } else {
      // 名前で指定された場合
      const found = sessions.find(s => s.name === args);
      if (found) {
        targetSession = found.name;
      }
    }

    if (!targetSession) {
      await respond({
        text: `❌ セッション「${args}」が見つかりません\n\nセッション一覧:\n${formatSessionList(sessions)}`
      });
      return;
    }

    // セッションが存在するか確認
    const exists = await tmuxConnector.sessionExists(targetSession);
    if (!exists) {
      await respond({
        text: `❌ tmuxセッション「${targetSession}」が存在しません`
      });
      return;
    }

    // ワーキングディレクトリを取得
    const workingDir = await tmuxConnector.getWorkingDirectory(targetSession);

    // 新しいスレッドを開始する形でメッセージを投稿
    const message = await app.client.chat.postMessage({
      channel: command.channel_id,
      text: `✅ \`${targetSession}\` に接続しました\n📁 \`${workingDir}\`\n\nこのスレッド内で自由にコマンドを入力してください`
    });

    // セッションマッピングを作成
    await sessionManager.createSession(message.ts!, targetSession, command.channel_id);

  } catch (error) {
    console.error('Error connecting to tmux session:', error);
    await respond({
      text: `❌ セッションへの接続に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Handle thread messages
app.message(async ({ message, say }: SlackEventMiddlewareArgs<'message'>) => {
  const messageEvent = message as SlackMessageEvent;

  // スレッド内のメッセージのみ処理
  if (!messageEvent.thread_ts) {
    return;
  }

  // Botからのメッセージは無視
  if (messageEvent.user === undefined) {
    return;
  }

  try {
    const threadTs = messageEvent.thread_ts;
    const text = messageEvent.text?.trim();

    if (!text) {
      return;
    }

    // セッションマッピングを取得
    const session = sessionManager.getSession(threadTs);

    if (!session) {
      // セッションが見つからない場合は無視
      return;
    }

    // セッションが存在するか確認
    const exists = await tmuxConnector.sessionExists(session.tmuxSession);
    if (!exists) {
      await say({
        text: `❌ tmuxセッション「${session.tmuxSession}」が見つかりません。セッションが終了した可能性があります。`,
        thread_ts: threadTs
      });
      await sessionManager.removeSession(threadTs);
      return;
    }

    // 最終アクティビティを更新
    await sessionManager.updateActivity(threadTs);

    // 非同期でコマンドを実行（タイムアウトなし）
    await asyncExecutor.executeCommand({
      tmuxSession: session.tmuxSession,
      command: text,
      channelId: messageEvent.channel,
      threadTs: threadTs,
      slackClient: app.client
    });

  } catch (error) {
    console.error('Error handling thread message:', error);
    await say({
      text: `❌ エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      thread_ts: messageEvent.thread_ts
    });
  }
});

// Error handling
app.error(async (error) => {
  console.error('Slack app error:', error);
  if (error.stack) {
    console.error('Error stack:', error.stack);
  }
});

// Start the app
(async () => {
  try {
    // Load existing session mappings
    await sessionManager.load();

    // Start Slack app
    await app.start();
    console.log('⚡️ Slack Claude Code Bot (Tmux Mode) is running!');
    console.log('📋 Commands:');
    console.log('  /cl - List tmux sessions');
    console.log('  /c <session> - Connect to tmux session');

    // Cleanup inactive sessions every 30 minutes
    setInterval(async () => {
      await sessionManager.cleanupInactiveSessions(60); // 60分非アクティブでクリーンアップ
    }, 30 * 60 * 1000);

  } catch (error) {
    console.error('Failed to start app:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await sessionManager.save();
  process.exit(0);
});
