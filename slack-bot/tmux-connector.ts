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
   * tmuxセッションの出力を取得（全履歴）
   * @param sessionName セッション名
   */
  async captureOutput(sessionName: string): Promise<string> {
    try {
      // 全履歴を取得（ANSIエスケープシーケンス付き）
      const { stdout } = await execAsync(`tmux capture-pane -t ${sessionName} -p -e -S -`);
      return stdout;
    } catch (error) {
      console.error(`Failed to capture output from ${sessionName}:`, error);
      return '';
    }
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
