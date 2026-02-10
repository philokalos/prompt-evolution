#!/bin/bash
# Mac App Store 앱 수동 서명 스크립트

set -e

echo "🔐 Mac App Store 앱 서명 시작..."

# 버전 자동 감지
VERSION=$(node -p "require('./package.json').version")

# 설정
APP_PATH="release/mas-arm64/PromptLint.app"
IDENTITY="3rd Party Mac Developer Application: Kyeol Kim (UTNLRZ42SP)"
INSTALLER_IDENTITY="3rd Party Mac Developer Installer: Kyeol Kim (UTNLRZ42SP)"
ENTITLEMENTS="certs/entitlements.mas.plist"
ENTITLEMENTS_INHERIT="certs/entitlements.mas.inherit.plist"
PROVISIONING_PROFILE="certs/embedded.provisionprofile"
PKG_OUTPUT="release/PromptLint-${VERSION}-mas.pkg"

# ⚠️ 빌드 전 entitlements 검증: temporary-exception 이 포함되면 Apple 심사 거절됨
echo ""
echo "⚠️  Entitlements 사전 검증..."
FORBIDDEN_ENTITLEMENTS=(
  "com.apple.security.temporary-exception.apple-events"
  "com.apple.security.automation.apple-events"
  "com.apple.security.temporary-exception"
)
for forbidden in "${FORBIDDEN_ENTITLEMENTS[@]}"; do
  if grep -q "$forbidden" "$ENTITLEMENTS"; then
    echo "❌ 오류: $ENTITLEMENTS 에 금지된 entitlement 발견: $forbidden"
    echo "   MAS 빌드에서는 Apple Events 관련 entitlement 을 사용할 수 없습니다."
    echo "   Guideline 2.4.5(i) 위반으로 심사가 거절됩니다."
    exit 1
  fi
  if grep -q "$forbidden" "$ENTITLEMENTS_INHERIT"; then
    echo "❌ 오류: $ENTITLEMENTS_INHERIT 에 금지된 entitlement 발견: $forbidden"
    exit 1
  fi
done
echo "✅ Entitlements 검증 통과 (apple-events 없음)"

echo ""
echo "📦 앱 경로: $APP_PATH"
echo "🔑 인증서: $IDENTITY"
echo "📌 버전: $VERSION"

# 앱 존재 여부 확인
if [ ! -d "$APP_PATH" ]; then
  echo "❌ 오류: $APP_PATH 가 존재하지 않습니다."
  echo "   먼저 'npm run dist:mas' 를 실행하세요."
  exit 1
fi

# 0. quarantine 속성 제거
echo ""
echo "0️⃣ quarantine 속성 제거..."
xattr -cr "$APP_PATH"

# 1. 네이티브 라이브러리 서명 (가장 깊은 것부터)
echo ""
echo "1️⃣ 네이티브 라이브러리 서명..."

# Electron Framework 라이브러리들
FRAMEWORK_PATH="$APP_PATH/Contents/Frameworks/Electron Framework.framework"
if [ -d "$FRAMEWORK_PATH/Versions/A/Libraries" ]; then
  echo "  Electron Framework 라이브러리..."
  find "$FRAMEWORK_PATH/Versions/A/Libraries" -name "*.dylib" -print0 | while IFS= read -r -d '' lib; do
    echo "    서명: $(basename "$lib")"
    codesign --sign "$IDENTITY" \
      --entitlements "$ENTITLEMENTS_INHERIT" \
      --timestamp \
      --force \
      "$lib"
  done
fi

# better-sqlite3.node 같은 네이티브 모듈
echo "  네이티브 Node 모듈..."
find "$APP_PATH/Contents/Resources/app.asar.unpacked" -name "*.node" -print0 2>/dev/null | while IFS= read -r -d '' node_module; do
  echo "    서명: $(basename "$node_module")"
  codesign --sign "$IDENTITY" \
    --entitlements "$ENTITLEMENTS_INHERIT" \
    --timestamp \
    --force \
    "$node_module"
done || true

# 2. Provisioning Profile 설치
echo ""
echo "2️⃣ Provisioning Profile 설치..."
cp "$PROVISIONING_PROFILE" "$APP_PATH/Contents/embedded.provisionprofile"

# 헬퍼 앱에도 provisioning profile 설치
for helper in "PromptLint Helper" "PromptLint Helper (GPU)" "PromptLint Helper (Plugin)" "PromptLint Helper (Renderer)"; do
  HELPER_PATH="$APP_PATH/Contents/Frameworks/$helper.app"
  if [ -d "$HELPER_PATH" ]; then
    echo "  Profile 설치: $helper"
    cp "$PROVISIONING_PROFILE" "$HELPER_PATH/Contents/embedded.provisionprofile"
  fi
done

# Login Helper에도 provisioning profile 설치
LOGIN_HELPER="$APP_PATH/Contents/Library/LoginItems/PromptLint Login Helper.app"
if [ -d "$LOGIN_HELPER" ]; then
  echo "  Profile 설치: Login Helper"
  cp "$PROVISIONING_PROFILE" "$LOGIN_HELPER/Contents/embedded.provisionprofile"
fi

# Provisioning profile 복사 후 quarantine 속성 제거
echo ""
echo "  Provisioning profile quarantine 속성 제거..."
xattr -cr "$APP_PATH"

# 3. 헬퍼 앱들 서명
echo ""
echo "3️⃣ 헬퍼 앱 서명..."
for helper in "PromptLint Helper" "PromptLint Helper (GPU)" "PromptLint Helper (Plugin)" "PromptLint Helper (Renderer)"; do
  HELPER_PATH="$APP_PATH/Contents/Frameworks/$helper.app"
  if [ -d "$HELPER_PATH" ]; then
    echo "  서명 중: $helper"
    codesign --sign "$IDENTITY" \
      --entitlements "$ENTITLEMENTS_INHERIT" \
      --timestamp \
      --force \
      "$HELPER_PATH"
  fi
done

# 3.5 Login Helper 서명
if [ -d "$LOGIN_HELPER" ]; then
  echo "  서명 중: Login Helper"
  codesign --sign "$IDENTITY" \
    --entitlements "$ENTITLEMENTS_INHERIT" \
    --timestamp \
    --force \
    "$LOGIN_HELPER"
fi

# 4. Framework 서명
echo ""
echo "4️⃣ Electron Framework 서명..."
# 먼저 Electron Framework 실행 파일
codesign --sign "$IDENTITY" \
  --entitlements "$ENTITLEMENTS_INHERIT" \
  --timestamp \
  --force \
  "$FRAMEWORK_PATH/Versions/A/Electron Framework"

# 그다음 Framework 전체
codesign --sign "$IDENTITY" \
  --entitlements "$ENTITLEMENTS_INHERIT" \
  --timestamp \
  --force \
  "$FRAMEWORK_PATH"

# 5. 메인 앱 서명
echo ""
echo "5️⃣ 메인 앱 서명..."
codesign --sign "$IDENTITY" \
  --entitlements "$ENTITLEMENTS" \
  --timestamp \
  --force \
  "$APP_PATH"

# 6. 서명 검증
echo ""
echo "6️⃣ 서명 검증..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

# 6.5 서명된 바이너리의 entitlements 확인 (apple-events 없어야 함)
echo ""
echo "6️⃣.5 서명된 entitlements 검증..."
SIGNED_ENTITLEMENTS=$(codesign -d --entitlements - "$APP_PATH/Contents/MacOS/PromptLint" 2>&1 || true)
if echo "$SIGNED_ENTITLEMENTS" | grep -qi "apple-events"; then
  echo "❌ 경고: 서명된 바이너리에 apple-events entitlement이 발견되었습니다!"
  echo "$SIGNED_ENTITLEMENTS"
  echo ""
  echo "이 상태로 제출하면 Guideline 2.4.5(i)로 거절됩니다."
  echo "entitlements.mas.plist 를 확인하세요."
  exit 1
fi
echo "✅ 서명된 바이너리에 apple-events entitlement 없음 확인"

# 7. PKG 생성 전 quarantine 속성 다시 제거
echo ""
echo "7️⃣ PKG 생성 전 최종 정리..."
xattr -cr "$APP_PATH"

# 8. PKG 생성
echo ""
echo "8️⃣ .pkg 생성..."
productbuild --component "$APP_PATH" /Applications \
  --sign "$INSTALLER_IDENTITY" \
  "$PKG_OUTPUT"

echo ""
echo "✅ 서명 완료!"
echo "📦 결과 파일: $PKG_OUTPUT"
echo ""
echo "다음 단계:"
echo "1. Transporter 앱으로 $PKG_OUTPUT 업로드"
echo "2. App Store Connect에서 메타데이터 작성"
echo "3. 심사 제출"
