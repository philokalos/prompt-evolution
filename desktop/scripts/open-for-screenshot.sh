#!/bin/bash

# App Store 스크린샷용 앱 실행 스크립트
# 2880×1800 (16:10 비율)에 최적화된 크기로 앱을 실행합니다

echo "📸 App Store 스크린샷용 PromptLint 실행"
echo "목표 해상도: 2880×1800 (16:10)"
echo ""

# 앱이 이미 실행 중이면 종료
if pgrep -x "Electron" > /dev/null; then
    echo "⚠️  기존 앱 종료 중..."
    pkill -x "Electron"
    sleep 2
fi

# 환경변수 설정: 창 크기를 1440×900으로 설정
# (레티나 디스플레이에서 캡처하면 자동으로 2880×1800이 됨)
export SCREENSHOT_MODE=true
export WINDOW_WIDTH=1440
export WINDOW_HEIGHT=900

echo "✅ 창 크기: ${WINDOW_WIDTH}×${WINDOW_HEIGHT}"
echo "   (레티나 캡처 시 자동으로 2880×1800)"
echo ""

# 앱 빌드 및 실행
cd "$(dirname "$0")/.."
npm run build:all && npm run start

# 또는 개발 모드로 실행:
# npm run dev:electron
