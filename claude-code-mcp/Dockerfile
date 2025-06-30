FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy root package files and tsconfig
COPY ../package*.json ../tsconfig.json /app/
COPY ../claude-code-mcp/package*.json /app/claude-code-mcp/

# Install all dependencies (including dev dependencies for building)
RUN cd /app && npm ci
RUN cd /app/claude-code-mcp && npm ci

# Copy source files
COPY ../claude-code-mcp/*.ts /app/claude-code-mcp/

# Build TypeScript
RUN cd /app && npm run build

# Production stage
FROM node:22-alpine

# Install Claude Code CLI requirements
RUN apk add --no-cache curl bash git openssh-client

# Install Claude CLI (placeholder - replace with actual installation)
# Note: You need to provide the actual Claude installation method
# RUN curl -fsSL https://claude.ai/install.sh | sh

WORKDIR /app

# Copy package files
COPY claude-code-mcp/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist/claude-code-mcp ./

# Create workspace directory
RUN mkdir -p /workspace

# Start the MCP server
CMD ["node", "index.js"]