#!/bin/bash

# Start test script for Slack Claude Code Integration

echo "🚀 Starting Slack Claude Code Integration in TEST MODE"
echo "===================================================="

# Change to project directory
cd /home/yusuke/engineers-hub.ltd/in-house-project/slack-claude-code-integration

# Set test mode environment variable
export TEST_MODE=false

# Build the TypeScript code
echo "Building TypeScript code..."
npm run build

# Start the application
echo "Starting Slack Bot with MCP Server..."
node dist/slack-bot/index.js