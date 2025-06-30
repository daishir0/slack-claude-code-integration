FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create workspace directory
RUN mkdir -p /workspace

# Start the bot
CMD ["node", "index.js"]