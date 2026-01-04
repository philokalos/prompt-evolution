#!/bin/bash
#
# Prompt Evolution Dashboard Server Startup Script
#
# This script starts the dashboard server in production mode.
# Used by LaunchAgent for auto-start on login.
#

set -e

# Configuration
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$LOG_DIR/server.pid"
LOG_FILE="$LOG_DIR/server.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Change to project directory
cd "$PROJECT_DIR"

# Check if already running
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo "Server already running (PID: $OLD_PID)"
    exit 0
  fi
  rm "$PID_FILE"
fi

# Set environment
export NODE_ENV=production
export PORT=3001

# Start server
echo "[$(date)] Starting Prompt Evolution Dashboard..." >> "$LOG_FILE"
nohup node dist/server/index.js >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "Server started (PID: $(cat $PID_FILE))"
echo "Dashboard: http://localhost:3001"
echo "Logs: $LOG_FILE"
