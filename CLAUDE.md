# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Slack integration system that enables teams to use Claude Code through Slack using the Model Context Protocol (MCP). The architecture follows:

```
Slack → Slack Bot → Claude Code MCP Server → Claude Code CLI
```

## Essential Commands

### Development
```bash
# Initial setup (installs all dependencies)
npm run setup

# Build TypeScript code
npm run build         # One-time build
npm run build:watch   # Watch mode for development

# Run in development mode (builds and watches)
npm run dev

# Run tests (currently placeholder)
npm test

# Code quality
npm run lint          # Check TypeScript and JavaScript files
npm run lint:fix      # Auto-fix lint errors  
npm run format        # Format all code with Prettier
npm run format:check  # Check formatting

# Start in test mode (uses echo instead of Claude CLI)
./start-test.sh
```

### Docker Operations
```bash
npm run docker:build  # Build Docker images
npm run docker:up     # Start services
npm run docker:down   # Stop services
```

### Git Hooks
Lefthook is configured to run pre-commit checks automatically. To manually install:
```bash
npx lefthook install
```

## Architecture

### Component Structure
- **claude-code-mcp/**: MCP server that wraps Claude Code CLI (TypeScript)
  - Source: `claude-code-mcp/index.ts`
  - Built to: `dist/claude-code-mcp/index.js`
  - Implements stdio-based MCP protocol
  - Handles `tools/list` and `tools/call` methods
  - Spawns Claude CLI or echo (test mode) as child process

- **slack-bot/**: Slack Bolt application (TypeScript)
  - Source: `slack-bot/index.ts`
  - Built to: `dist/slack-bot/index.js`
  - Connects to MCP server as client
  - Handles app mentions, DMs, and slash commands
  - Manages project path switching via `--project` flag

### Key Integration Points

1. **MCP Communication**: The Slack bot creates a StdioClientTransport to communicate with the MCP server, which runs as a separate Node.js process.

2. **Environment Variables**: 
   - Slack tokens: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`
   - Claude settings: `CLAUDE_PATH`, `PROJECT_PATH`
   - Mode control: `TEST_MODE=true/false`

3. **Test Mode**: When `TEST_MODE=true`, the MCP server uses echo commands instead of Claude CLI, useful for development and debugging.

## Working with Slack App

The Slack app requires specific OAuth scopes and event subscriptions configured in the Slack App dashboard:
- Socket Mode must be enabled with `connections:write` scope
- Bot token scopes: `app_mentions:read`, `chat:write`, `commands`, `im:history`, `im:read`, `im:write`
- Event subscriptions: `app_mention`, `message.im`
- Slash command: `/claude`

## Important Implementation Details

### Error Handling Pattern
Both components use Promise-based error handling with proper logging to stderr for MCP compliance.

### Message Formatting
The bot automatically wraps responses in code blocks if they don't already contain them (see `formatCodeBlock` function).

### Project Path Resolution
Users can specify different projects using `--project /path/to/project` in their commands. The path is extracted and passed to the MCP server.

### Graceful Shutdown
Both services handle SIGINT for clean disconnection of MCP transport and Slack connections.

## TypeScript Development

The project is written in TypeScript and requires building before running:

1. **Build Process**: Run `npm run build` to compile TypeScript files to JavaScript in the `dist/` directory
2. **Type Safety**: Strict TypeScript settings are enabled in `tsconfig.json`
3. **Development Workflow**: Use `npm run dev` which includes automatic rebuilding on file changes

## Debugging Tips

- Check MCP server logs with `[MCP]` prefix in stderr
- Slack bot logs connection status and available tools on startup
- Use `DEBUG=true` environment variable for verbose logging
- The test mode (`TEST_MODE=true`) is invaluable for troubleshooting without affecting actual projects
- TypeScript build errors will be shown during `npm run build`