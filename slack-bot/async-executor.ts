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

        // 完了判定
        if (this.tmuxConnector.isCommandComplete(currentOutput)) {
          // 完了！画面が安定するまで待機（出力が変化しなくなるまで）
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

          // コマンドプロンプト（`>` で始まる行）を探して、2番目に最後のプロンプトから最後のプロンプトの手前までを取得
          const lines = finalOutput.split('\n');
          const promptIndices: number[] = [];

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().match(/^>/)) {
              promptIndices.push(i);
              console.log(`[AsyncExecutor] Prompt found at line ${i}: "${lines[i]}"`);
            }
          }

          console.log('[AsyncExecutor] Total prompts found:', promptIndices.length);

          let newOutput = finalOutput;

          // 2番目に最後のプロンプトから最後のプロンプトの手前までを取得
          if (promptIndices.length >= 2) {
            const secondLastPromptIndex = promptIndices[promptIndices.length - 2];
            const lastPromptIndex = promptIndices[promptIndices.length - 1];
            console.log(`[AsyncExecutor] Extracting lines ${secondLastPromptIndex} to ${lastPromptIndex}`);
            newOutput = lines.slice(secondLastPromptIndex, lastPromptIndex).join('\n').trim();
          } else if (promptIndices.length === 1) {
            // プロンプトが1つしかない場合、その後ろから最後まで
            const promptIndex = promptIndices[0];
            console.log(`[AsyncExecutor] Single prompt found, extracting from line ${promptIndex}`);
            newOutput = lines.slice(promptIndex).join('\n').trim();
          }

          console.log('[AsyncExecutor] Extracted output length:', newOutput.length);
          console.log('[AsyncExecutor] First 200 chars:', newOutput.substring(0, 200));

          // 処理中画面の行を除外
          const outputLines = newOutput.split('\n');
          const filteredLines = outputLines.filter(line => {
            const trimmed = line.trim();
            // 処理中インジケータを除外
            if (trimmed.startsWith('✢') || trimmed.startsWith('✻') ||
                trimmed.startsWith('∴') || trimmed.includes('undefined…') ||
                trimmed.includes('Thinking…') || trimmed.startsWith('⎿')) {
              return false;
            }
            return true;
          });
          newOutput = filteredLines.join('\n').trim();

          console.log('[AsyncExecutor] After filtering, length:', newOutput.length);
          console.log('[AsyncExecutor] After filtering, first 200 chars:', newOutput.substring(0, 200));

          // 出力を分割
          const chunks = this.splitOutput(newOutput || 'コマンドが実行されましたが、出力がありません');

          // 最初のメッセージを更新
          await slackClient.chat.update({
            channel: channelId,
            ts: messageTs,
            text: `✅ 完了 (${this.formatDuration(duration)}) ${chunks.length > 1 ? `[1/${chunks.length}]` : ''}\n\n\`\`\`\n${chunks[0]}\n\`\`\``
          });

          // 2番目以降のメッセージを投稿
          for (let i = 1; i < chunks.length; i++) {
            await slackClient.chat.postMessage({
              channel: channelId,
              thread_ts: threadTs,
              text: `✅ 完了 (${this.formatDuration(duration)}) [${i + 1}/${chunks.length}]\n\n\`\`\`\n${chunks[i]}\n\`\`\``
            });
          }

          this.activeExecutions.delete(executionKey);

          return {
            output: currentOutput,
            duration,
            completed: true
          };
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
   * sleep関数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
