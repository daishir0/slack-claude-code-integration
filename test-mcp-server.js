#!/usr/bin/env node
const { spawn } = require('child_process');
const readline = require('readline');

// Test MCP Server directly
const server = spawn('node', ['claude-code-mcp/index.js'], {
  env: { ...process.env, TEST_MODE: 'true' }
});

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Buffer for server responses
let responseBuffer = '';

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log('Server response:', JSON.stringify(message, null, 2));
      } catch (e) {
        // Not JSON, just log it
        console.log('Server output:', line);
      }
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Send initialization message
setTimeout(() => {
  const initMessage = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    },
    id: 1
  };
  
  console.log('Sending initialize:', initMessage);
  server.stdin.write(JSON.stringify(initMessage) + '\n');
}, 100);

// Test tools/list after initialization
setTimeout(() => {
  const listToolsMessage = {
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 2
  };
  
  console.log('Sending tools/list:', listToolsMessage);
  server.stdin.write(JSON.stringify(listToolsMessage) + '\n');
}, 1000);

// Test tool call
setTimeout(() => {
  const callToolMessage = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'claude_code',
      arguments: {
        prompt: 'list files in current directory'
      }
    },
    id: 3
  };
  
  console.log('Sending tools/call:', callToolMessage);
  server.stdin.write(JSON.stringify(callToolMessage) + '\n');
}, 2000);

// Keep process alive
setTimeout(() => {
  console.log('Test completed');
  server.kill();
  process.exit(0);
}, 5000);