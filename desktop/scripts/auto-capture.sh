#!/bin/bash
# Automated Screenshot Capture Script
# Requires: npm run dev:electron running in another terminal

set -e

SCREENSHOT_DIR="./screenshots"
TEMP_DIR="/tmp/promptlint-screenshots"
mkdir -p "$SCREENSHOT_DIR" "$TEMP_DIR"

echo "🎬 PromptLint App Store Screenshot Automation"
echo "==========================================="
echo ""
echo "⚠️  Prerequisites:"
echo "   Terminal 1: npm run dev:electron"
echo "   (Make sure the app is visible and ready)"
echo ""
echo "📸 This script will:"
echo "   1. Capture 5 screenshots automatically"
echo "   2. Resize to 2880×1800"
echo "   3. Save to $SCREENSHOT_DIR"
echo ""

read -p "Press Enter to start in 5 seconds..." -t 5 || true

echo ""
echo "🎥 Starting automatic capture sequence..."
echo ""

# Function to capture window
capture_screenshot() {
    local name=$1
    local description=$2
    local delay=$3

    echo "📸 Screenshot: $name"
    echo "   Description: $description"

    sleep "$delay"

    # Capture focused window (PromptLint)
    screencapture -w "$TEMP_DIR/$name.png" 2>/dev/null || {
        echo "   ❌ Failed to capture (is PromptLint window in focus?)"
        return 1
    }

    echo "   ✅ Captured"
}

# Screenshot 1: GOLDEN Analysis
capture_screenshot "1-analysis" "GOLDEN Radar Analysis" 2 && \
echo "   👉 Now scroll down to see prompt variants..." && \

# Screenshot 2: Prompt Variants
sleep 3
capture_screenshot "2-variants" "Prompt Variants" 1 && \
echo "   👉 Now click Progress tab..." && \

# Screenshot 3: Progress
sleep 3
capture_screenshot "3-progress" "Progress Tracker" 1 && \
echo "   👉 Now click Tips tab..." && \

# Screenshot 4: Tips
sleep 3
capture_screenshot "4-tips" "Personal Tips" 1 && \
echo "   👉 Now click Settings..." && \

# Screenshot 5: Settings
sleep 3
capture_screenshot "5-settings" "Settings" 1

echo ""
echo "🔄 Resizing screenshots to 2880×1800..."

# Resize using sharp (via Node.js)
node - <<'NODEJS'
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = '/tmp/promptlint-screenshots';
const SCREENSHOT_DIR = './screenshots';
const files = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.png'));

let completed = 0;

files.forEach(file => {
  const input = path.join(TEMP_DIR, file);
  const output = path.join(SCREENSHOT_DIR, file);

  sharp(input)
    .resize(2880, 1800, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255 }
    })
    .png()
    .toFile(output)
    .then(() => {
      console.log(`✅ ${file} (2880×1800)`);
      completed++;

      if (completed === files.length) {
        console.log('\n✅ All screenshots ready!');
        console.log(`📁 Location: ${SCREENSHOT_DIR}`);
      }
    })
    .catch(err => console.error(`❌ ${file}:`, err.message));
});
NODEJS

echo ""
echo "📋 Next steps:"
echo "1. Visit App Store Connect"
echo "2. Select PromptLint → App Information → Screenshots"
echo "3. Language: 한국어"
echo "4. Upload all 5 screenshots"
echo ""
echo "✨ Done!"
