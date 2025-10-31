/**
 * SessionManager - Slackスレッドとtmuxセッションのマッピング管理
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface SessionMapping {
  threadTs: string;          // Slackスレッドタイムスタンプ
  tmuxSession: string;       // tmuxセッション名
  createdAt: Date;           // セッション作成日時
  lastActivity: Date;        // 最終アクティビティ日時
  channelId: string;         // Slackチャンネ​​ルID
}

export class SessionManager {
  private sessions: Map<string, SessionMapping> = new Map();
  private mappingFile: string;

  constructor(mappingFile: string = './session-mapping.json') {
    this.mappingFile = path.resolve(mappingFile);
  }

  /**
   * セッションマッピングをファイルから読み込み
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.mappingFile, 'utf8');
      const mappings: SessionMapping[] = JSON.parse(data);

      this.sessions.clear();
      for (const mapping of mappings) {
        // 日付文字列をDateオブジェクトに変換
        mapping.createdAt = new Date(mapping.createdAt);
        mapping.lastActivity = new Date(mapping.lastActivity);
        this.sessions.set(mapping.threadTs, mapping);
      }

      console.log(`Loaded ${this.sessions.size} session mappings`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('No existing session mapping file found, starting fresh');
      } else {
        console.error('Error loading session mappings:', error);
      }
    }
  }

  /**
   * セッションマッピングをファイルに保存
   */
  async save(): Promise<void> {
    try {
      const mappings = Array.from(this.sessions.values());
      await fs.writeFile(this.mappingFile, JSON.stringify(mappings, null, 2), 'utf8');
      console.log(`Saved ${mappings.length} session mappings`);
    } catch (error) {
      console.error('Error saving session mappings:', error);
    }
  }

  /**
   * 新しいセッションマッピングを作成
   */
  async createSession(
    threadTs: string,
    tmuxSession: string,
    channelId: string
  ): Promise<SessionMapping> {
    const mapping: SessionMapping = {
      threadTs,
      tmuxSession,
      channelId,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(threadTs, mapping);
    await this.save();

    return mapping;
  }

  /**
   * スレッドに紐づくセッションを取得
   */
  getSession(threadTs: string): SessionMapping | undefined {
    return this.sessions.get(threadTs);
  }

  /**
   * セッションが存在するか確認
   */
  hasSession(threadTs: string): boolean {
    return this.sessions.has(threadTs);
  }

  /**
   * セッションの最終アクティビティ時刻を更新
   */
  async updateActivity(threadTs: string): Promise<void> {
    const session = this.sessions.get(threadTs);
    if (session) {
      session.lastActivity = new Date();
      await this.save();
    }
  }

  /**
   * セッションを削除
   */
  async removeSession(threadTs: string): Promise<void> {
    this.sessions.delete(threadTs);
    await this.save();
  }

  /**
   * 全セッション一覧を取得
   */
  getAllSessions(): SessionMapping[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 古いセッションをクリーンアップ（指定時間以上アクティビティがないもの）
   * @param maxInactiveMinutes 非アクティブ時間の上限（分）
   */
  async cleanupInactiveSessions(maxInactiveMinutes: number = 60): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [threadTs, session] of this.sessions) {
      const inactiveMinutes = (now.getTime() - session.lastActivity.getTime()) / (1000 * 60);

      if (inactiveMinutes > maxInactiveMinutes) {
        this.sessions.delete(threadTs);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      await this.save();
      console.log(`Cleaned up ${cleanedCount} inactive sessions`);
    }

    return cleanedCount;
  }

  /**
   * 特定のtmuxセッションに紐づくSlackスレッド一覧を取得
   */
  getThreadsByTmuxSession(tmuxSession: string): string[] {
    const threads: string[] = [];

    for (const [threadTs, session] of this.sessions) {
      if (session.tmuxSession === tmuxSession) {
        threads.push(threadTs);
      }
    }

    return threads;
  }
}
