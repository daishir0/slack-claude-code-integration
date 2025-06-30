import { App, SlackEventMiddlewareArgs, SlackCommandMiddlewareArgs } from '@slack/bolt';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: path.join(__dirname, '..', '..', '.env') });

// Type definitions
interface SlackMentionEvent {
  type: 'app_mention';
  text: string;
  channel: string;
  ts: string;
  user: string;
}

interface SlackMessageEvent {
  type: 'message';
  text?: string;
  channel: string;
  channel_type?: string;
  ts: string;
  user: string;
}

interface ClaudeCodeResult {
  content?: Array<{ text: string }>;
}

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// MCP Client for Claude Code
class ClaudeCodeClient {
  private mcpServerPath: string;
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  constructor() {
    this.mcpServerPath = path.join(__dirname, '..', '..', 'dist', 'claude-code-mcp');
  }

  async connect(): Promise<void> {
    try {
      console.log('Connecting to Claude Code MCP Server...');

      // Create transport
      this.transport = new StdioClientTransport({
        command: 'node',
        args: ['index.js'],
        cwd: this.mcpServerPath,
        env: {
          ...process.env,
          CLAUDE_PATH: process.env.CLAUDE_PATH || 'claude',
          PROJECT_PATH: process.env.PROJECT_PATH || process.cwd()
        }
      });

      // Create client
      this.client = new Client(
        {
          name: 'slack-claude-code-client',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      // Connect
      await this.client.connect(this.transport);
      this.isConnected = true;
      console.log('Connected to Claude Code MCP Server');

      // List available tools
      const toolsResponse = await this.client.listTools();
      console.log('Available tools:', JSON.stringify(toolsResponse.tools, null, 2));
    } catch (error) {
      console.error('Failed to connect to MCP Server:', error);
      throw error;
    }
  }

  async executeCommand(prompt: string, cwd?: string): Promise<string> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error('MCP Client not initialized');
    }

    try {
      console.log(`Executing command: ${prompt}`);
      const result = await this.client.callTool({
        name: 'claude_code',
        arguments: {
          prompt,
          cwd: cwd || process.env.PROJECT_PATH
        }
      }) as ClaudeCodeResult;

      return result.content?.[0]?.text || 'No response from Claude Code';
    } catch (error) {
      console.error('Error executing Claude Code command:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('Disconnected from Claude Code MCP Server');
    }
  }
}

// Initialize Claude Code client
const claudeClient = new ClaudeCodeClient();

// Helper function to extract project path from message
function extractProjectPath(text: string): string | null {
  const pathMatch = text.match(/--project[= ]([^ ]+)/);
  return pathMatch ? pathMatch[1] : null;
}

// Helper function to format code blocks
function formatCodeBlock(text: string): string {
  // If the text already contains code blocks, return as is
  if (text.includes('```')) {
    return text;
  }

  // Otherwise, wrap in a code block
  return `\`\`\`\n${text}\n\`\`\``;
}

// Handle app mentions
app.event('app_mention', async ({ event, say }: SlackEventMiddlewareArgs<'app_mention'>) => {
  const mentionEvent = event as SlackMentionEvent;
  console.log('Received app_mention event:', JSON.stringify(mentionEvent, null, 2));

  try {
    // Extract the command from the mention
    const text = mentionEvent.text.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (!text || text.toLowerCase() === 'help') {
      await say({
        text: `こんにちは！Claude Codeコマンドを実行できます。
        
使い方:
\`\`\`
@Claude Code Assistant <あなたの指示>
@Claude Code Assistant <あなたの指示> --project /path/to/project
\`\`\`

例:
• \`@Claude Code Assistant このプロジェクトのテストを実行して\`
• \`@Claude Code Assistant package.jsonの内容を確認して\`
• \`@Claude Code Assistant src/index.jsのバグを修正して\``,
        thread_ts: mentionEvent.ts
      });
      return;
    }

    // Send initial acknowledgment
    const ackMessage = await app.client.chat.postMessage({
      channel: mentionEvent.channel,
      text: '🤖 Claude Codeで処理中...',
      thread_ts: mentionEvent.ts
    });

    // Extract project path if specified
    const projectPath = extractProjectPath(text);
    const cleanPrompt = text.replace(/--project[= ][^ ]+/, '').trim();

    // Execute Claude Code command
    console.log(`Executing command: ${cleanPrompt}`);
    const result = await claudeClient.executeCommand(cleanPrompt, projectPath || undefined);

    // Update the message with the result
    await app.client.chat.update({
      channel: mentionEvent.channel,
      ts: ackMessage.ts || '',
      text: formatCodeBlock(result),
      thread_ts: mentionEvent.ts
    });
  } catch (error) {
    console.error('Error handling app mention:', error);

    await say({
      text: `❌ エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      thread_ts: mentionEvent.ts
    });
  }
});

// Handle direct messages
app.message(async ({ message, say }: SlackEventMiddlewareArgs<'message'>) => {
  const messageEvent = message as SlackMessageEvent;
  
  // Only respond to DMs
  if (messageEvent.channel_type !== 'im') {
    return;
  }

  try {
    const text = messageEvent.text;

    if (!text || text.toLowerCase() === 'help') {
      await say({
        text: `*Claude Code Bot の使い方*
        
以下のようにコマンドを送信してください:
• \`<あなたの指示>\` - デフォルトプロジェクトで実行
• \`<あなたの指示> --project /path/to/project\` - 特定のプロジェクトで実行

*例:*
• \`テストを実行して結果を教えて\`
• \`src/components/Button.tsx のバグを修正して\`
• \`新機能のブランチを作成して --project /home/user/myproject\`
        `
      });
      return;
    }

    // Send initial acknowledgment
    await say('🤖 Claude Codeで処理中...');

    // Extract project path if specified
    const projectPath = extractProjectPath(text);
    const cleanPrompt = text.replace(/--project[= ][^ ]+/, '').trim();

    // Execute Claude Code command
    const result = await claudeClient.executeCommand(cleanPrompt, projectPath || undefined);

    // Send the result
    await say(formatCodeBlock(result));
  } catch (error) {
    console.error('Error handling direct message:', error);
    await say(`❌ エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Handle slash commands
app.command('/claude', async ({ command, ack, respond }: SlackCommandMiddlewareArgs) => {
  await ack();

  try {
    const { text } = command;

    if (!text || text === 'help') {
      await respond({
        text: `*Claude Code Slash Command*
        
使い方: \`/claude <command> [--project /path]\`

例:
• \`/claude run tests\`
• \`/claude fix the bug in auth.js --project /home/projects/webapp\`
        `
      });
      return;
    }

    // Extract project path if specified
    const projectPath = extractProjectPath(text);
    const cleanPrompt = text.replace(/--project[= ][^ ]+/, '').trim();

    // Execute Claude Code command
    const result = await claudeClient.executeCommand(cleanPrompt, projectPath || undefined);

    await respond({
      text: formatCodeBlock(result)
    });
  } catch (error) {
    console.error('Error handling slash command:', error);
    await respond({
      text: `❌ エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    // Check if running in test mode from environment
    const testMode = process.env.TEST_MODE === 'true';

    // Connect to Claude Code MCP Server
    await claudeClient.connect();

    // Start Slack app
    await app.start();
    console.log('⚡️ Slack Claude Code Bot is running!');
    console.log(`Project path: ${process.env.PROJECT_PATH || 'current directory'}`);
    if (testMode) {
      console.log('🧪 Running in TEST MODE - using echo commands');
    } else {
      console.log('🚀 Running in PRODUCTION MODE - using Claude Code CLI');
    }
  } catch (error) {
    console.error('Failed to start app:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await claudeClient.disconnect();
  process.exit(0);
});