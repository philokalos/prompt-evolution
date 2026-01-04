#!/bin/bash
#
# Prompt Evolution Dashboard Server Stop Script
#

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$PROJECT_DIR/logs/server.pid"
LOG_FILE="$PROJECT_DIR/logs/server.log"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "[$(date)] Stopping server (PID: $PID)..." >> "$LOG_FILE"
    kill "$PID"
    rm "$PID_FILE"
    echo "Server stopped"
  else
    echo "Server not running (stale PID file)"
    rm "$PID_FILE"
  fi
else
  # Try to find and kill by process name
  pkill -f "node dist/server/index.js" 2>/dev/null && echo "Server stopped" || echo "Server not running"
fi
