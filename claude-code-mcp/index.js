#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class ClaudeCodeMCPServer {
  constructor() {
    this.claudePath = process.env.CLAUDE_PATH || 'claude';
    this.projectPath = process.env.PROJECT_PATH || process.cwd();

    // Create server with proper configuration
    this.server = new Server(
      {
        name: 'claude-code-mcp',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // Register list tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'claude_code',
          description: 'Execute Claude Code commands in a project directory',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'The prompt to send to Claude Code'
              },
              cwd: {
                type: 'string',
                description: 'Working directory (optional)'
              }
            },
            required: ['prompt']
          }
        }
      ]
    }));

    // Register call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'claude_code') {
        return await this.executeClaudeCode(request.params.arguments);
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  async executeClaudeCode({ prompt, cwd = this.projectPath }) {
    return new Promise((resolve, _reject) => {
      console.error(`[MCP] Executing Claude Code with prompt: ${prompt}`);
      console.error(`[MCP] Working directory: ${cwd}`);

      // Use echo to simulate Claude response for testing
      const isTest = process.env.TEST_MODE === 'true';
      const command = isTest ? 'echo' : this.claudePath;
      const args = isTest ? [`Claude would execute: "${prompt}" in ${cwd}`] : [];

      const claude = spawn(command, args, {
        cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      if (!isTest) {
        // Send the prompt to claude
        claude.stdin.write(`${prompt}\n`);
        claude.stdin.end();
      }

      claude.stdout.on('data', (data) => {
        output += data.toString();
      });

      claude.stderr.on('data', (data) => {
        error += data.toString();
      });

      claude.on('close', (code) => {
        console.error(`[MCP] Command completed with code: ${code}`);

        if (code === 0) {
          resolve({
            content: [
              {
                type: 'text',
                text: output || 'Command completed successfully'
              }
            ]
          });
        } else {
          resolve({
            content: [
              {
                type: 'text',
                text: `Error (code ${code}): ${error || 'Unknown error'}`
              }
            ],
            isError: true
          });
        }
      });

      claude.on('error', (err) => {
        console.error(`[MCP] Failed to start command: ${err.message}`);
        resolve({
          content: [
            {
              type: 'text',
              text: `Failed to execute: ${err.message}`
            }
          ],
          isError: true
        });
      });
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('[MCP] Claude Code MCP Server started');
    console.error(`[MCP] Claude path: ${this.claudePath}`);
    console.error(`[MCP] Project path: ${this.projectPath}`);
  }
}

// Start the server
async function main() {
  try {
    const server = new ClaudeCodeMCPServer();
    await server.start();
  } catch (error) {
    console.error('[MCP] Failed to start server:', error);
    process.exit(1);
  }
}

main();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('\n[MCP] Shutting down Claude Code MCP Server...');
  process.exit(0);
});
