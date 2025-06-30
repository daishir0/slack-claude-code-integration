const { App } = require('@slack/bolt');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// MCP Client for Claude Code
class ClaudeCodeClient {
  constructor() {
    this.mcpServerPath = path.join(__dirname, '..', 'claude-code-mcp');
    this.client = null;
    this.transport = null;
    this.isConnected = false;
  }

  async connect() {
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
      this.client = new Client({
        name: 'slack-claude-code-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

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

  async executeCommand(prompt, cwd) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      console.log(`Executing command: ${prompt}`);
      const result = await this.client.callTool('claude_code', {
        prompt: prompt,
        cwd: cwd || process.env.PROJECT_PATH
      });
      
      return result.content?.[0]?.text || 'No response from Claude Code';
    } catch (error) {
      console.error('Error executing Claude Code command:', error);
      throw error;
    }
  }

  async disconnect() {
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
function extractProjectPath(text) {
  const pathMatch = text.match(/--project[= ]([^ ]+)/);
  return pathMatch ? pathMatch[1] : null;
}

// Helper function to format code blocks
function formatCodeBlock(text) {
  // If the text already contains code blocks, return as is
  if (text.includes('```')) {
    return text;
  }
  
  // Otherwise, wrap in a code block
  return `\`\`\`\n${text}\n\`\`\``;
}

// Handle app mentions
app.event('app_mention', async ({ event, client, say }) => {
  console.log('Received app_mention event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract the command from the mention
    const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
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
        thread_ts: event.ts
      });
      return;
    }

    // Send initial acknowledgment
    const ackMessage = await client.chat.postMessage({
      channel: event.channel,
      text: '🤖 Claude Codeで処理中...',
      thread_ts: event.ts
    });

    // Extract project path if specified
    const projectPath = extractProjectPath(text);
    const cleanPrompt = text.replace(/--project[= ][^ ]+/, '').trim();

    // Execute Claude Code command
    console.log(`Executing command: ${cleanPrompt}`);
    const result = await claudeClient.executeCommand(cleanPrompt, projectPath);

    // Update the message with the result
    await client.chat.update({
      channel: event.channel,
      ts: ackMessage.ts,
      text: formatCodeBlock(result),
      thread_ts: event.ts
    });

  } catch (error) {
    console.error('Error handling app mention:', error);
    
    await say({
      text: `❌ エラーが発生しました: ${error.message}`,
      thread_ts: event.ts
    });
  }
});

// Handle direct messages
app.message(async ({ message, say }) => {
  // Only respond to DMs
  if (message.channel_type !== 'im') return;
  
  try {
    const text = message.text;
    
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
    const result = await claudeClient.executeCommand(cleanPrompt, projectPath);

    // Send the result
    await say(formatCodeBlock(result));

  } catch (error) {
    console.error('Error handling direct message:', error);
    await say(`❌ エラーが発生しました: ${error.message}`);
  }
});

// Handle slash commands
app.command('/claude', async ({ command, ack, respond }) => {
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
    const result = await claudeClient.executeCommand(cleanPrompt, projectPath);

    await respond({
      text: formatCodeBlock(result)
    });

  } catch (error) {
    console.error('Error handling slash command:', error);
    await respond({
      text: `❌ エラーが発生しました: ${error.message}`
    });
  }
});

// Error handling
app.error(async (error) => {
  console.error('Slack app error:', error);
  console.error('Error stack:', error.stack);
});

// Start the app
(async () => {
  try {
    // Start with test mode first
    process.env.TEST_MODE = 'true';
    
    // Connect to Claude Code MCP Server
    await claudeClient.connect();
    
    // Start Slack app
    await app.start();
    console.log('⚡️ Slack Claude Code Bot is running!');
    console.log(`Project path: ${process.env.PROJECT_PATH || 'current directory'}`);
    console.log('🧪 Running in TEST MODE - using echo commands');
    
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