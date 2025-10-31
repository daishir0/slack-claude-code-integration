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
   * @param lines 取得する行数（デフォルト: 200行）
   */
  async captureOutput(sessionName: string, lines: number = 200): Promise<string> {
    try {
      // 方法1: ANSIエスケープシーケンスを含めて取得
      const { stdout: output1 } = await execAsync(`tmux capture-pane -t ${sessionName} -p -e -S -${lines}`);

      // 方法2: 通常のキャプチャ
      const { stdout: output2 } = await execAsync(`tmux capture-pane -t ${sessionName} -p -S -${lines}`);

      // 方法3: 全履歴を取得
      const { stdout: output3 } = await execAsync(`tmux capture-pane -t ${sessionName} -p -e -S -`);

      // 「esc to interrupt」が含まれているものを優先
      if (output1.toLowerCase().includes('esc to interrupt')) {
        console.log('[TmuxConnector] Found "esc to interrupt" in output1 (with ANSI)');
        return output1;
      }
      if (output2.toLowerCase().includes('esc to interrupt')) {
        console.log('[TmuxConnector] Found "esc to interrupt" in output2 (normal)');
        return output2;
      }
      if (output3.toLowerCase().includes('esc to interrupt')) {
        console.log('[TmuxConnector] Found "esc to interrupt" in output3 (full history)');
        return output3;
      }

      // どれにも含まれていない場合は最も長いものを返す
      console.log('[TmuxConnector] "esc to interrupt" not found in any output');
      console.log(`[TmuxConnector] output1 length: ${output1.length}, output2 length: ${output2.length}, output3 length: ${output3.length}`);

      if (output3.length > output1.length && output3.length > output2.length) {
        return output3;
      } else if (output1.length > output2.length) {
        return output1;
      } else {
        return output2;
      }
    } catch (error) {
      console.error(`Failed to capture output from ${sessionName}:`, error);
      return '';
    }
  }

  /**
   * コマンドが完了したか判定
   * 「esc to interrupt」が表示されていない = 完了
   */
  isCommandComplete(output: string): boolean {
    if (!output) return false;

    // 処理中インジケータをチェック
    const processingIndicators = [
      /esc to interrupt/i,   // Claude Code処理中（最重要）
    ];

    // 全体をチェック
    for (const pattern of processingIndicators) {
      if (pattern.test(output)) {
        console.log('[TmuxConnector] Still processing: found processing indicator');
        return false;
      }
    }

    // 処理中インジケータがなければ完了
    console.log('[TmuxConnector] Command completed: no processing indicators found');
    return true;
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
