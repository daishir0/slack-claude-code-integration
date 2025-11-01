/**
 * AsyncExecutor - 非同期コマンド実行とステータス更新を担当
 * シンプルポーリング方式: 10秒間隔で差分を送信
 */

import { TmuxConnector } from './tmux-connector';
import { WebClient } from '@slack/web-api';

export interface ExecutionOptions {
  tmuxSession: string;      // tmuxセッション名
  command: string;          // 実行するコマンド
  channelId: string;        // Slackチャンネル​​ID
  threadTs: string;         // Slackスレッドタイムスタンプ
  slackClient: WebClient;   // Slack APIクライアント
}

export interface ExecutionResult {
  output: string;
  duration: number;
  completed: boolean;
}

export class AsyncExecutor {
  private tmuxConnector: TmuxConnector;
  private activeExecutions: Map<string, boolean> = new Map();
  private lastSentMessages: Map<string, string> = new Map(); // executionKey -> 直前に送信したメッセージ
  private readonly POLL_INTERVAL = 10000; // 10秒固定
  private readonly DEBUG: boolean;

  constructor(tmuxConnector: TmuxConnector) {
    this.tmuxConnector = tmuxConnector;
    this.DEBUG = process.env.DEBUG === 'true';
    if (this.DEBUG) {
      console.log('[AsyncExecutor] DEBUG MODE ENABLED');
    }
  }

  /**
   * 経過時間を人間が読みやすい形式に変換
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}分${remainingSeconds}秒`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}時間${minutes}分`;
    }
  }

  /**
   * 出力を分割する（Slackのメッセージ長制限対策）
   */
  private splitOutput(output: string, maxLength: number = 2500): string[] {
    if (output.length <= maxLength) {
      return [output];
    }

    const chunks: string[] = [];
    let remaining = output;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      const chunk = remaining.substring(0, maxLength);
      const lastNewline = chunk.lastIndexOf('\n');

      if (lastNewline > 0) {
        chunks.push(remaining.substring(0, lastNewline));
        remaining = remaining.substring(lastNewline + 1);
      } else {
        chunks.push(chunk);
        remaining = remaining.substring(maxLength);
      }
    }

    return chunks;
  }

  /**
   * ANSIエスケープシーケンスを除去
   */
  private removeAnsiEscapeCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B\[[\?0-9;]*[a-zA-Z]/g, '');
  }

  /**
   * 差分を計算して整形（アンカーポイント方式）
   */
  private calculateDiff(previousOutput: string, currentOutput: string): string {
    // ANSIエスケープシーケンスを除去してから比較
    const cleanPrevious = this.removeAnsiEscapeCodes(previousOutput);
    const cleanCurrent = this.removeAnsiEscapeCodes(currentOutput);

    if (this.DEBUG) {
      console.log('[AsyncExecutor] === calculateDiff START ===');
      console.log(`[AsyncExecutor] Previous output length: ${cleanPrevious.length} chars`);
      console.log(`[AsyncExecutor] Current output length: ${cleanCurrent.length} chars`);
    }

    // 初回の場合（前回の出力がない）- 何も送信しない
    if (!cleanPrevious) {
      if (this.DEBUG) {
        console.log('[AsyncExecutor] No previous output (first poll), returning empty');
      }
      return '';
    }

    // 出力が短くなった場合（画面クリアの可能性）
    const possibleScreenClear = cleanCurrent.length < cleanPrevious.length;
    if (possibleScreenClear) {
      if (this.DEBUG) {
        console.log(
          `[AsyncExecutor] ⚠️ Output size decreased: ${cleanPrevious.length} → ${cleanCurrent.length} (possible screen clear)`
        );
        console.log('[AsyncExecutor] Will attempt anchor matching to detect content change');
      }
      // 画面クリア後も新しいコンテンツがある可能性があるため、アンカーマッチングを続行
    }

    // 出力が全く同じ長さの場合のみスキップ
    if (cleanCurrent.length === cleanPrevious.length) {
      if (this.DEBUG) {
        console.log('[AsyncExecutor] Output length unchanged, returning empty');
      }
      return '';
    }

    // ステータスバーを除外してアンカーを作成
    const prevLines = cleanPrevious.split('\n');
    const currLines = cleanCurrent.split('\n');

    // ステータスバーと進捗表示を除外
    const isStatusLine = (line: string): boolean => {
      const trimmed = line.trim();
      return (
        trimmed.includes('esc to interrupt') ||
        trimmed.includes('Thinking') ||
        trimmed.includes('Writing') ||
        trimmed.includes('Reading') ||
        trimmed.includes('✻') ||
        trimmed.includes('✢') ||
        trimmed.includes('∴') ||
        trimmed.includes('⏵') ||  // ステータスインジケータ
        trimmed.includes('⎿') ||  // ツリー表示記号
        trimmed.includes('bypass permissions on') ||  // ステータスバー
        trimmed.includes('Tip:') ||  // ヒント表示
        /^\s*\d+%\s*$/.test(trimmed) ||  // 進捗パーセンテージ（例: "9%"）
        /^[─\-═│┃┌┐└┘├┤┬┴┼]+$/.test(trimmed) ||  // プログレスバーの罫線
        /^\s+\d+%\s*$/.test(trimmed) ||  // スペース付きパーセンテージ
        /\d+\s+tokens/.test(trimmed) ||  // トークンカウント（例: "56857 tokens"）
        /^>/.test(trimmed) ||  // プロンプト行すべて（`>`で始まる行）
        /^[░▒▓█▀▄■]+$/.test(trimmed) ||  // ボックス描画文字のみの行
        trimmed.includes('globalVersion') ||  // バージョン情報
        trimmed.includes('latestVersion')  // バージョン情報
      );
    };

    const prevFiltered = prevLines.filter(line => !isStatusLine(line));
    const currFiltered = currLines.filter(line => !isStatusLine(line));

    if (this.DEBUG) {
      console.log(`[AsyncExecutor] Previous lines: ${prevLines.length} → ${prevFiltered.length} (after filter)`);
      console.log(`[AsyncExecutor] Current lines: ${currLines.length} → ${currFiltered.length} (after filter)`);
    }

    // 【削除】フィルタ後の行数チェックは削除（ステータスバー更新を見逃すため）

    // 空行でない行だけを抽出してアンカーを作成
    const prevNonEmpty = prevFiltered.filter(line => line.trim().length > 0);
    const currNonEmpty = currFiltered.filter(line => line.trim().length > 0);

    if (prevNonEmpty.length === 0) {
      if (this.DEBUG) {
        console.log('[AsyncExecutor] No non-empty lines in previous output for anchor');
      }
      return '';
    }

    // アンカーポイント方式: 前回の末尾N行（空行除外）を今回の出力から探す
    const anchorSize = Math.min(10, prevNonEmpty.length); // 末尾10行をアンカーとする
    const anchorLines = prevNonEmpty.slice(-anchorSize);
    const anchor = anchorLines.join('\n');

    if (this.DEBUG) {
      console.log(`[AsyncExecutor] Non-empty lines: prev=${prevNonEmpty.length}, curr=${currNonEmpty.length}`);
      console.log(`[AsyncExecutor] Anchor size: ${anchorSize} lines (${anchor.length} chars)`);
      console.log(`[AsyncExecutor] Anchor lines:`);
      anchorLines.forEach((line, i) => {
        console.log(`[AsyncExecutor]   [${i}] "${line.substring(0, 80)}"`);
      });
    }

    // 今回の出力（空行除外）を文字列に戻す
    const currNonEmptyStr = currNonEmpty.join('\n');

    // 今回の出力からアンカーを探す
    const anchorIndex = currNonEmptyStr.indexOf(anchor);

    if (anchorIndex >= 0) {
      // アンカーが見つかった！その直後から末尾までが新しい内容
      const diffStartPos = anchorIndex + anchor.length;
      const diff = currNonEmptyStr.substring(diffStartPos);

      if (this.DEBUG) {
        console.log(`[AsyncExecutor] ✅ Anchor found at position ${anchorIndex}`);
        console.log(`[AsyncExecutor] Diff starts at position ${diffStartPos}`);
        console.log(`[AsyncExecutor] Raw diff length: ${diff.length} chars`);

        if (diff.length === 0) {
          console.log(`[AsyncExecutor] ⚠️ WARNING: Diff is 0 chars!`);
          console.log(`[AsyncExecutor] currNonEmptyStr total length: ${currNonEmptyStr.length}`);
          console.log(`[AsyncExecutor] anchorIndex: ${anchorIndex}, anchor.length: ${anchor.length}`);
          console.log(`[AsyncExecutor] This means anchor is at the very end of current output`);
        } else {
          console.log(`[AsyncExecutor] Raw diff preview (first 500 chars): "${diff.substring(0, 500)}"`);
        }
      }

      // さらにフィルタリングして返す
      const filtered = this.filterOutput(diff);

      if (this.DEBUG) {
        console.log(`[AsyncExecutor] Filtered diff length: ${filtered.length} chars`);
        if (filtered.length > 0) {
          console.log(`[AsyncExecutor] Filtered diff preview (first 300 chars): "${filtered.substring(0, 300)}"`);
        } else if (diff.length > 0) {
          console.log(`[AsyncExecutor] ⚠️ WARNING: Raw diff was ${diff.length} chars but filtered to 0!`);
          console.log(`[AsyncExecutor] All content was filtered out`);
        }
      }

      return filtered;
    } else {
      // アンカーが見つからない = より小さいアンカー（末尾3行）で再試行
      const smallAnchorSize = Math.min(3, prevNonEmpty.length);
      const smallAnchorLines = prevNonEmpty.slice(-smallAnchorSize);
      const smallAnchor = smallAnchorLines.join('\n');
      const smallAnchorIndex = currNonEmptyStr.indexOf(smallAnchor);

      if (this.DEBUG) {
        console.log(`[AsyncExecutor] ⚠️ Anchor not found, trying smaller anchor (${smallAnchorSize} lines)`);
        console.log(`[AsyncExecutor] Small anchor lines:`);
        smallAnchorLines.forEach((line, i) => {
          console.log(`[AsyncExecutor]   [${i}] "${line.substring(0, 80)}"`);
        });
      }

      if (smallAnchorIndex >= 0) {
        const diffStartPos = smallAnchorIndex + smallAnchor.length;
        const diff = currNonEmptyStr.substring(diffStartPos);

        if (this.DEBUG) {
          console.log(`[AsyncExecutor] ✅ Small anchor found at position ${smallAnchorIndex}`);
          console.log(`[AsyncExecutor] Diff length: ${diff.length} chars`);

          if (diff.length === 0) {
            console.log(`[AsyncExecutor] ⚠️ WARNING: Small anchor diff is also 0 chars!`);
          } else {
            console.log(`[AsyncExecutor] Diff preview (first 500 chars): "${diff.substring(0, 500)}"`);
          }
        }

        const filtered = this.filterOutput(diff);

        if (this.DEBUG && diff.length > 0 && filtered.length === 0) {
          console.log(`[AsyncExecutor] ⚠️ WARNING: Small anchor diff was ${diff.length} chars but filtered to 0!`);
        }

        return filtered;
      } else {
        // それでも見つからない
        if (this.DEBUG) {
          console.log('[AsyncExecutor] ❌ No anchor found even with small anchor');
          console.log('[AsyncExecutor] This might be a significant screen change');
        }

        // 画面クリアの場合、簡潔な通知のみ
        if (possibleScreenClear) {
          if (this.DEBUG) {
            console.log(`[AsyncExecutor] 📺 Screen clear detected, sending notification only`);
          }
          return '📺 画面がクリアされました';
        } else {
          // 画面クリアではない場合、安全のため空を返す
          if (this.DEBUG) {
            console.log('[AsyncExecutor] Returning empty for safety');
          }
          return '';
        }
      }
    }
  }

  /**
   * 出力をフィルタリング（不要な行を除去）
   */
  private filterOutput(output: string): string {
    const lines = output.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;

      // Claude Codeの処理中インジケータを除外
      if (trimmed.startsWith('✢') || trimmed.startsWith('✻') ||
          trimmed.startsWith('∴') || trimmed.includes('undefined…') ||
          trimmed.includes('Thinking…') || trimmed.startsWith('⎿') ||
          trimmed.includes('bypass permissions on') ||
          trimmed.includes('esc to interrupt') ||
          /^>[\s　]*$/.test(trimmed) ||
          /^[─\-═]{10,}$/.test(trimmed)) {
        return false;
      }

      return true;
    });

    return filteredLines.join('\n').trim();
  }

  /**
   * 単純ポーリング方式でコマンドを実行
   * - 10秒ごとに出力をチェック
   * - 差分があればSlackに送信
   * - tmuxセッションが存在する限り継続
   */
  async executeCommand(options: ExecutionOptions): Promise<ExecutionResult> {
    const { tmuxSession, command, channelId, threadTs, slackClient } = options;
    // tmuxSessionを含めることで、複数のセッションを同時に監視可能にする
    const executionKey = `${channelId}-${threadTs}-${tmuxSession}`;

    // 既に実行中の場合は、既存の監視を停止して新しい監視を開始
    if (this.activeExecutions.get(executionKey)) {
      console.log(`[AsyncExecutor] ⚠️ Session ${tmuxSession} is already being monitored. Stopping old monitoring and starting new one.`);
      this.activeExecutions.delete(executionKey);
      this.lastSentMessages.delete(executionKey); // 前回のメッセージ履歴もクリア
      // await slackClient.chat.postMessage({
      //   channel: channelId,
      //   thread_ts: threadTs,
      //   text: `⚠️ セッション ${tmuxSession} の既存の監視を停止して、新しいコマンドの監視を開始します`
      // });
      // 既存の監視が停止するまで少し待つ
      await this.sleep(2000);
    }

    // 実行中フラグをセット
    this.activeExecutions.set(executionKey, true);

    // 初期メッセージを投稿
    const initialMessage = await slackClient.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: '🔄 監視開始... (10秒ごとに出力をチェックします)'
    });

    const statusMessageTs = initialMessage.ts as string;
    const startTime = Date.now();
    let sentMessageCount = 0;

    try {
      // tmuxにコマンドを送信
      console.log(`[AsyncExecutor] Sending command to tmux: ${command}`);
      await this.tmuxConnector.sendCommand(tmuxSession, command);

      let lastOutput = '';
      let lastStatusUpdate = Date.now();

      // 無限ループでポーリング（tmuxセッションが存在する限り）
      while (this.activeExecutions.get(executionKey)) {
        // 10秒待機
        await this.sleep(this.POLL_INTERVAL);

        // tmuxセッションが存在するか確認
        const sessionExists = await this.tmuxConnector.sessionExists(tmuxSession);
        if (!sessionExists) {
          console.log(`[AsyncExecutor] Tmux session ${tmuxSession} no longer exists`);
          await slackClient.chat.postMessage({
            channel: channelId,
            thread_ts: threadTs,
            text: '⚠️ tmuxセッションが終了しました'
          });
          break;
        }

        // tmux出力を取得
        const currentOutput = await this.tmuxConnector.captureOutput(tmuxSession);

        // 差分を計算
        const diff = this.calculateDiff(lastOutput, currentOutput);

        // 差分があればSlackに送信
        if (diff.length > 0) {
          console.log(`[AsyncExecutor] New output detected: ${diff.length} chars`);

          // 長い差分は分割して送信
          const chunks = this.splitOutput(diff, 2500);
          for (let i = 0; i < chunks.length; i++) {
            sentMessageCount++;

            // 前回送信したメッセージと比較
            const currentMessage = chunks[i];
            const lastMessage = this.lastSentMessages.get(executionKey);

            // 同一メッセージの場合はスキップ
            if (lastMessage === currentMessage) {
              if (this.DEBUG) {
                console.log(`[AsyncExecutor] Skipping duplicate message (${currentMessage.length} chars)`);
              }
              continue;
            }

            // 異なるメッセージのみ送信
            const messageToSend = `\`\`\`\n${currentMessage}\n\`\`\``;

            await slackClient.chat.postMessage({
              channel: channelId,
              thread_ts: threadTs,
              text: messageToSend
            });

            // 送信後に保存
            this.lastSentMessages.set(executionKey, currentMessage);
          }
        }

        // lastOutputは差分の有無に関わらず毎回更新
        lastOutput = currentOutput;

        // 30秒ごとにステータスメッセージを更新
        const now = Date.now();
        if (now - lastStatusUpdate >= 30000) {
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          await slackClient.chat.update({
            channel: channelId,
            ts: statusMessageTs,
            text: `🔄 監視中... ⏱️ ${this.formatDuration(elapsedSeconds)} | 送信: ${sentMessageCount}件`
          });
          lastStatusUpdate = now;
        }
      }

      // 監視終了
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await slackClient.chat.update({
        channel: channelId,
        ts: statusMessageTs,
        text: `⏸️ 監視終了 (${this.formatDuration(duration)}) | 送信: ${sentMessageCount}件`
      });

      this.activeExecutions.delete(executionKey);
      this.lastSentMessages.delete(executionKey);

      return {
        output: lastOutput,
        duration,
        completed: true
      };

    } catch (error) {
      console.error(`[AsyncExecutor] Error executing command:`, error);

      await slackClient.chat.update({
        channel: channelId,
        ts: statusMessageTs,
        text: `❌ エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      this.activeExecutions.delete(executionKey);
      this.lastSentMessages.delete(executionKey);
      throw error;
    }
  }

  /**
   * 実行をキャンセル
   */
  cancelExecution(channelId: string, threadTs: string): void {
    const executionKey = `${channelId}-${threadTs}`;
    this.activeExecutions.delete(executionKey);
    console.log(`[AsyncExecutor] Execution cancelled: ${executionKey}`);
  }

  /**
   * sleep関数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
