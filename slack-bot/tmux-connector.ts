/**
 * TmuxConnector - tmuxセッションとの通信を担当
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TmuxSession {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
}

export class TmuxConnector {
  /**
   * tmuxセッション一覧を取得
   */
  async listSessions(): Promise<TmuxSession[]> {
    try {
      const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_created}:#{session_attached}"');

      const sessions: TmuxSession[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        if (!line) continue;

        const [name, windows, created, attached] = line.split(':');
        sessions.push({
          name,
          windows: parseInt(windows, 10),
          created,
          attached: attached === '1'
        });
      }

      return sessions;
    } catch (error) {
      if (error instanceof Error && error.message.includes('no server running')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * tmuxセッションが存在するか確認
   */
  async sessionExists(sessionName: string): Promise<boolean> {
    try {
      await execAsync(`tmux has-session -t ${sessionName}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * tmuxセッションにコマンドを送信
   */
  async sendCommand(sessionName: string, command: string): Promise<void> {
    const escapedCommand = command.replace(/"/g, '\\"');
    // Claude Codeのプロンプトは特殊なインタラクティブUIのため、
    // テキスト送信後に待機してからEnterキーを2回送る
    await execAsync(`tmux send-keys -t ${sessionName} "${escapedCommand}"`);
    // 200ms待機してからEnterキー送信（UIの更新を待つ）
    await this.sleep(200);
    // Enterを2回送信（1回目で確定、2回目で送信）
    await execAsync(`tmux send-keys -t ${sessionName} C-m`);
    await this.sleep(50);
    await execAsync(`tmux send-keys -t ${sessionName} C-m`);
  }

  /**
   * sleep関数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * tmuxセッションの出力を取得
   * @param sessionName セッション名
   * @param lines 取得する行数（デフォルト: 100行）
   */
  async captureOutput(sessionName: string, lines: number = 100): Promise<string> {
    try {
      const { stdout } = await execAsync(`tmux capture-pane -t ${sessionName} -p -S -${lines}`);
      return stdout;
    } catch (error) {
      console.error(`Failed to capture output from ${sessionName}:`, error);
      return '';
    }
  }

  /**
   * コマンドが完了したか判定（プロンプト検知）
   * Claude Codeの完了を正確に判定するため、以下を確認：
   * 1. 処理中インジケータが表示されていない
   * 2. 最後の行が空プロンプト（`> ` のみ）
   * 3. その前に区切り線がある
   */
  isCommandComplete(output: string): boolean {
    if (!output) return false;

    const lines = output.split('\n');

    // 処理中インジケータをチェック
    const processingIndicators = [
      /✢.*undefined/,        // 処理中インジケータ
      /✻.*undefined/,        // 処理中インジケータ
      /∴.*Thinking/,         // 思考中表示
      /⏵⏵.*preparing/i,     // 準備中表示
    ];

    // 最後の20行をチェック
    const lastLines = lines.slice(-20);

    // 処理中インジケータがあれば未完了
    for (const line of lastLines) {
      for (const pattern of processingIndicators) {
        if (pattern.test(line)) {
          return false;
        }
      }
    }

    // ステータスバーのパターン（除外する）
    const statusBarPatterns = [
      /⏵⏵.*tokens?$/i,           // トークンカウンター
      /bypass permissions/i,      // パーミッションステータス
      /plan mode/i,               // モード表示
    ];

    // 最後の非空行を探す（ステータスバーと区切り線を除外）
    let lastNonEmptyLine = '';
    let lastNonEmptyIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.match(/^[─]+$/)) {
        // 空行または区切り線はスキップ
        continue;
      }

      // ステータスバーかチェック
      let isStatusBar = false;
      for (const pattern of statusBarPatterns) {
        if (pattern.test(trimmed)) {
          isStatusBar = true;
          break;
        }
      }

      if (!isStatusBar) {
        lastNonEmptyLine = trimmed;
        lastNonEmptyIndex = i;
        break;
      }
    }

    // 最後の非空行が空プロンプト（`> ` のみ、またはそれ以下）かチェック
    if (!lastNonEmptyLine.match(/^>\s*$/)) {
      return false;
    }

    // その前に区切り線があるかチェック（最後の10行以内）
    let hasSeparator = false;
    for (let i = Math.max(0, lastNonEmptyIndex - 10); i < lastNonEmptyIndex; i++) {
      if (lines[i].trim().match(/^[─]+$/)) {
        hasSeparator = true;
        break;
      }
    }

    return hasSeparator;
  }

  /**
   * 出力が変化したか確認
   */
  hasOutputChanged(previousOutput: string, currentOutput: string): boolean {
    return previousOutput !== currentOutput;
  }

  /**
   * セッションのワーキングディレクトリを取得
   */
  async getWorkingDirectory(sessionName: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`tmux display-message -t ${sessionName} -p "#{pane_current_path}"`);
      return stdout.trim();
    } catch (error) {
      console.error(`Failed to get working directory for ${sessionName}:`, error);
      return '';
    }
  }
}
