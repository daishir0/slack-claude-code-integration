#!/bin/bash

# Slack DM File Upload Script
# Usage: ./send_file_to_dm.sh <file_path> [comment]

if [ $# -lt 1 ]; then
    echo "Usage: $0 <file_path> [comment]"
    exit 1
fi

FILE_PATH="$1"
COMMENT="${2:-📄 ファイル送信}"

if [ ! -f "$FILE_PATH" ]; then
    echo "❌ Error: File not found: $FILE_PATH"
    exit 1
fi

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env file not found at $ENV_FILE"
    exit 1
fi

export $(grep -v '^#' "$ENV_FILE" | xargs)

# Activate conda environment and execute Python script
source /home/ec2-user/anaconda3/bin/activate
conda activate 311

python3 << EOF
import os
import sys
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

token = os.environ.get('SLACK_BOT_TOKEN')
if not token:
    print("❌ Error: SLACK_BOT_TOKEN not set")
    sys.exit(1)

client = WebClient(token=token)

try:
    # Upload file directly to DM channel
    dm_channel_id = "D09PDFREBGF"
    result = client.files_upload_v2(
        channel=dm_channel_id,
        file="$FILE_PATH",
        initial_comment="$COMMENT"
    )

    print(f"✅ ファイル送信成功！")
    if 'files' in result and len(result['files']) > 0:
        print(f"File ID: {result['files'][0]['id']}")

except SlackApiError as e:
    print(f"❌ SlackApiError: {e.response['error']}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Exception: {str(e)}")
    sys.exit(1)
EOF
