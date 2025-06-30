#!/bin/bash

echo "🚀 Slack-Claude Code Integration Setup"
echo "======================================"

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20 or later."
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

# Check Claude CLI
if ! command -v claude &> /dev/null; then
    echo "⚠️  Claude CLI is not installed or not in PATH."
    echo "   Please install from: https://claude.ai/code"
    echo "   Or set CLAUDE_PATH in your .env file"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. Docker is optional but recommended."
fi

echo "✅ Prerequisites check complete!"
echo ""

# Setup environment
echo "🔧 Setting up environment..."

# Copy .env.example if .env doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file. Please edit it with your credentials."
else
    echo "✓ .env file already exists"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm run setup

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env file with your Slack credentials"
echo "2. Set PROJECT_PATH to your target project directory"
echo "3. Run 'npm run dev' to start in development mode"
echo "4. Or use 'npm run docker:up' to run with Docker"
echo ""
echo "Happy coding! 🎉"