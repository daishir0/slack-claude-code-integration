/**
 * AsyncExecutor - 非同期コマンド実行とステータス更新を担当
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

  constructor(tmuxConnector: TmuxConnector) {
    this.tmuxConnector = tmuxConnector;
  }

  /**
   * 更新頻度を経過時間に応じて動的に調整
   */
  private getUpdateInterval(elapsedSeconds: number): number {
    if (elapsedSeconds < 30) return 2000;       // 最初の30秒: 2秒ごと
    if (elapsedSeconds < 300) return 5000;      // 30秒〜5分: 5秒ごと
    if (elapsedSeconds < 1800) return 10000;    // 5分〜30分: 10秒ごと
    return 30000;                                // 30分以上: 30秒ごと
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
   * ヘッダーやマークダウンを考慮して、実際の上限より小さくする
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

      // maxLengthで切り取る
      const chunk = remaining.substring(0, maxLength);
      const lastNewline = chunk.lastIndexOf('\n');

      // 最後の改行で分割（文の途中で切らないように）
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
   * 非同期でコマンドを実行し、定期的にステータスを更新
   * タイムアウトなし、完了まで無限に待機
   */
  async executeCommand(options: ExecutionOptions): Promise<ExecutionResult> {
    const { tmuxSession, command, channelId, threadTs, slackClient } = options;
    const executionKey = `${channelId}-${threadTs}`;

    // 実行中フラグをセット
    this.activeExecutions.set(executionKey, true);

    // 初期メッセージを投稿
    const initialMessage = await slackClient.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: '🔄 処理中...'
    });

    const messageTs = initialMessage.ts as string;
    const startTime = Date.now();

    try {
      // tmuxにコマンドを送信
      await this.tmuxConnector.sendCommand(tmuxSession, command);

      let lastOutput = '';
      let noChangeCount = 0;
      let lastUpdateTime = Date.now();
      let completionCount = 0;  // 完了判定の安定性カウンター

      // 完了するまで無限ループ（タイムアウトなし）
      while (this.activeExecutions.get(executionKey)) {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const updateInterval = this.getUpdateInterval(elapsedSeconds);

        // インターバル待機
        await this.sleep(updateInterval);

        // tmuxから出力を取得
        const currentOutput = await this.tmuxConnector.captureOutput(tmuxSession);

        // 出力が変化したか確認
        const outputChanged = this.tmuxConnector.hasOutputChanged(lastOutput, currentOutput);

        if (outputChanged) {
          noChangeCount = 0;
        } else {
          noChangeCount++;
        }

        // 定期的にステータスメッセージを更新
        const now = Date.now();
        if (now - lastUpdateTime >= updateInterval || outputChanged) {
          const statusText = `🔄 処理中... ⏱️ ${this.formatDuration(elapsedSeconds)}`;

          await slackClient.chat.update({
            channel: channelId,
            ts: messageTs,
            text: statusText
          });

          lastUpdateTime = now;
        }

        // 完了判定（安定性チェック付き）
        if (this.tmuxConnector.isCommandComplete(currentOutput)) {
          completionCount++;
          console.log(`[AsyncExecutor] Completion detected (${completionCount}/2), checking stability...`);

          if (completionCount < 2) {
            // まだ安定していない、次のループで再確認
            lastOutput = currentOutput;
            continue;
          }

          // 2回連続で完了判定が出た！画面が安定するまで待機（出力が変化しなくなるまで）
          console.log('[AsyncExecutor] Completion confirmed after stability check');
          let stableOutput = currentOutput;
          let stabilityCount = 0;
          const requiredStability = 3;  // 3回連続で変化がなければ安定とみなす

          console.log('[AsyncExecutor] Waiting for output to stabilize...');

          while (stabilityCount < requiredStability) {
            await this.sleep(1000);  // 1秒待機
            const newOutput = await this.tmuxConnector.captureOutput(tmuxSession);

            if (newOutput === stableOutput) {
              stabilityCount++;
              console.log(`[AsyncExecutor] Output stable (${stabilityCount}/${requiredStability})`);
            } else {
              stabilityCount = 0;
              stableOutput = newOutput;
              console.log('[AsyncExecutor] Output changed, resetting stability counter');
            }
          }

          console.log('[AsyncExecutor] Output stabilized after waiting');
          const finalOutput = stableOutput;

          const duration = Math.floor((Date.now() - startTime) / 1000);

          console.log('[AsyncExecutor] === DEBUG: 完了判定 ===');
          console.log('[AsyncExecutor] 最終出力の行数:', finalOutput.split('\n').length);

          // ANSIエスケープシーケンスを除去
          let cleanOutput = this.removeAnsiEscapeCodes(finalOutput);

          console.log('[AsyncExecutor] Clean output length:', cleanOutput.length);
          console.log('[AsyncExecutor] First 200 chars:', cleanOutput.substring(0, 200));

          // 最新のClaude応答を抽出（行頭 > で始まる最後の行から抽出）
          const lines = cleanOutput.split('\n');
          let startIndex = -1;

          // 最後から検索して、行頭に "> " で始まる最後の行を見つける（ユーザーのコマンド入力）
          for (let i = lines.length - 1; i >= 0; i--) {
            const trimmed = lines[i].trim();
            if (trimmed.startsWith('> ')) {  // 半角スペース付き
              startIndex = i;
              console.log(`[AsyncExecutor] Found user prompt at line ${i}: "${trimmed.substring(0, 50)}..."`);
              break;
            }
          }

          // 見つからない場合は、最後の100行を使用（全履歴ではなく）
          let relevantLines = startIndex >= 0 ? lines.slice(startIndex) : lines.slice(-100);

          console.log(`[AsyncExecutor] Extracting from line ${startIndex}, total ${relevantLines.length} lines`);

          // 装飾的な区切り線、プロンプト、処理中インジケータを除外
          const filteredLines = relevantLines.filter(line => {
            const trimmed = line.trim();
            // 空行
            if (!trimmed) return false;
            // 装飾的な区切り線（─── の連続）
            if (/^[─\-═]{10,}$/.test(trimmed)) return false;
            // プロンプト行（> だけの行）
            if (/^>[\s　]*$/.test(trimmed)) return false;
            // 処理中インジケータを除外
            if (trimmed.startsWith('✢') || trimmed.startsWith('✻') ||
                trimmed.startsWith('∴') || trimmed.includes('undefined…') ||
                trimmed.includes('Thinking…') || trimmed.startsWith('⎿') ||
                trimmed.includes('bypass permissions on')) {
              return false;
            }
            return true;
          });
          const newOutput = filteredLines.join('\n').trim();

          console.log('[AsyncExecutor] After filtering, length:', newOutput.length);
          console.log('[AsyncExecutor] After filtering, first 200 chars:', newOutput.substring(0, 200));

          // 出力を分割
          const chunks = this.splitOutput(newOutput || 'コマンドが実行されましたが、出力がありません');
          console.log(`[AsyncExecutor] Split into ${chunks.length} chunks`);
          chunks.forEach((chunk, index) => {
            console.log(`[AsyncExecutor] Chunk ${index + 1} length: ${chunk.length}`);
          });

          // 最初のメッセージを短く更新（chat.updateは約2,000文字制限）
          await slackClient.chat.update({
            channel: channelId,
            ts: messageTs,
            text: `✅ 完了 (${this.formatDuration(duration)})`
          });

          // すべての出力をchat.postMessageで投稿（40,000文字制限）
          for (let i = 0; i < chunks.length; i++) {
            const outputMessage = `${chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n\n` : ''}\`\`\`\n${chunks[i]}\n\`\`\``;
            console.log(`[AsyncExecutor] Output message ${i + 1} length: ${outputMessage.length}`);

            await slackClient.chat.postMessage({
              channel: channelId,
              thread_ts: threadTs,
              text: outputMessage
            });
          }

          this.activeExecutions.delete(executionKey);

          return {
            output: currentOutput,
            duration,
            completed: true
          };
        } else {
          // 完了判定が出なかった場合はカウンターをリセット
          if (completionCount > 0) {
            console.log('[AsyncExecutor] Completion check reset - still processing');
            completionCount = 0;
          }
        }

        // 出力が長時間変化していない場合（5回連続 = 約25-150秒）
        if (noChangeCount >= 5) {
          // ユーザーに確認を求める（将来の拡張ポイント）
          console.log(`[AsyncExecutor] Output hasn't changed for ${noChangeCount} intervals`);
          // 現時点では継続して待機
        }

        lastOutput = currentOutput;
      }

      // 実行がキャンセルされた場合
      const duration = Math.floor((Date.now() - startTime) / 1000);
      return {
        output: lastOutput,
        duration,
        completed: false
      };

    } catch (error) {
      console.error(`[AsyncExecutor] Error executing command:`, error);

      // エラーメッセージを投稿
      await slackClient.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `❌ エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      this.activeExecutions.delete(executionKey);

      throw error;
    }
  }

  /**
   * 実行をキャンセル
   */
  cancelExecution(channelId: string, threadTs: string): void {
    const executionKey = `${channelId}-${threadTs}`;
    this.activeExecutions.delete(executionKey);
  }

  /**
   * ANSIエスケープシーケンスを除去
   */
  private removeAnsiEscapeCodes(text: string): string {
    // ANSIエスケープシーケンスを除去する正規表現
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B\[[\?0-9;]*[a-zA-Z]/g, '');
  }

  /**
   * sleep関数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
