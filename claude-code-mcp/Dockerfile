FROM node:22-alpine

# Install Claude Code CLI
RUN apk add --no-cache curl bash git openssh-client

# Install Claude CLI (placeholder - replace with actual installation)
# Note: You need to provide the actual Claude installation method
# RUN curl -fsSL https://claude.ai/install.sh | sh

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create workspace directory
RUN mkdir -p /workspace

# Expose port for HTTP transport (if needed)
EXPOSE 3001

# Start the MCP server
CMD ["node", "index.js"]