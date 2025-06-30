#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolRequest,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: path.join(__dirname, '..', '..', '.env') });

interface ClaudeCodeArguments {
  prompt: string;
  cwd?: string;
}

interface CommandResult {
  content: TextContent[];
  isError?: boolean;
}

class ClaudeCodeMCPServer {
  private server: Server;
  private claudePath: string;
  private projectPath: string;

  constructor() {
    this.claudePath = process.env.CLAUDE_PATH || 'claude';
    this.projectPath = process.env.PROJECT_PATH || process.cwd();

    this.server = new Server(
      {
        name: 'claude-code-server',
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

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async (): Promise<{ tools: Tool[] }> => {
      return {
        tools: [
          {
            name: 'claude_code',
            description: 'Execute Claude Code commands in a project directory',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The command or request for Claude Code'
                },
                cwd: {
                  type: 'string',
                  description: 'Working directory (optional, defaults to PROJECT_PATH)'
                }
              },
              required: ['prompt']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      if (request.params.name === 'claude_code') {
        const args = request.params.arguments as unknown as ClaudeCodeArguments;
        const result = await this.executeClaudeCode(args);
        return {
          content: result.content
        };
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  private async executeClaudeCode({ prompt, cwd = this.projectPath }: ClaudeCodeArguments): Promise<CommandResult> {
    return new Promise((resolve, _reject) => {
      console.error(`[MCP] Executing Claude Code with prompt: ${prompt}`);
      console.error(`[MCP] Working directory: ${cwd}`);

      // Use echo to simulate Claude response for testing
      const isTest = process.env.TEST_MODE === 'true';
      const command = isTest ? 'echo' : this.claudePath;
      const args = isTest ? [`Claude would execute: "${prompt}" in ${cwd}`] : [];

      const claude: ChildProcess = spawn(command, args, {
        cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      if (!isTest && claude.stdin) {
        // Send the prompt to claude
        claude.stdin.write(`${prompt}\n`);
        claude.stdin.end();
      }

      if (claude.stdout) {
        claude.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
      }

      if (claude.stderr) {
        claude.stderr.on('data', (data: Buffer) => {
          error += data.toString();
        });
      }

      claude.on('close', (code: number | null) => {
        console.error(`[MCP] Command completed with code: ${code}`);

        const textContent: TextContent = {
          type: 'text',
          text: ''
        };

        if (code === 0) {
          textContent.text = output || 'Command completed successfully';
          resolve({
            content: [textContent]
          });
        } else {
          textContent.text = `Error (code ${code}): ${error || 'Unknown error'}`;
          resolve({
            content: [textContent],
            isError: true
          });
        }
      });

      claude.on('error', (err: Error) => {
        console.error(`[MCP] Failed to start command: ${err.message}`);
        const textContent: TextContent = {
          type: 'text',
          text: `Failed to execute: ${err.message}`
        };
        resolve({
          content: [textContent],
          isError: true
        });
      });
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('[MCP] Claude Code MCP Server started');
    console.error(`[MCP] Claude path: ${this.claudePath}`);
    console.error(`[MCP] Project path: ${this.projectPath}`);
  }
}

// Start the server
async function main(): Promise<void> {
  try {
    const server = new ClaudeCodeMCPServer();
    await server.start();
  } catch (error) {
    console.error('[MCP] Failed to start server:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}