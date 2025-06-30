#!/bin/bash

# Create symbolic links for node_modules in dist directories
echo "Creating symbolic links for node_modules..."

# Create dist directories if they don't exist
mkdir -p dist/slack-bot
mkdir -p dist/claude-code-mcp

# Create symbolic links
if [ ! -L "dist/slack-bot/node_modules" ]; then
    ln -s ../../slack-bot/node_modules dist/slack-bot/node_modules
fi

if [ ! -L "dist/claude-code-mcp/node_modules" ]; then
    ln -s ../../claude-code-mcp/node_modules dist/claude-code-mcp/node_modules
fi

echo "✅ Symbolic links created successfully"