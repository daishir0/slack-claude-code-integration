FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy root package files and tsconfig
COPY ../package*.json ../tsconfig.json /app/
COPY ../slack-bot/package*.json /app/slack-bot/

# Install all dependencies (including dev dependencies for building)
RUN cd /app && npm ci
RUN cd /app/slack-bot && npm ci

# Copy source files
COPY ../slack-bot/*.ts /app/slack-bot/

# Build TypeScript
RUN cd /app && npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY slack-bot/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist/slack-bot ./

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Start the bot
CMD ["node", "index.js"]