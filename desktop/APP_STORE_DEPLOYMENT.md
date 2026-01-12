# macOS App Store 배포 가이드

**PromptLint v0.1.7** → App Store 정식 배포

## 현재 상태

✅ **배포 준비 완료**
- 기능 개발: 완료
- 테스트: 590개 통과 (100%)
- TypeScript: 에러 없음
- 빌드: 성공 (unsigned)

---

## 1단계: Apple Developer Account 설정

### 1.1 App Store Connect 앱 등록

1. **App Store Connect** ([appstoreconnect.apple.com](https://appstoreconnect.apple.com)) 로그인
2. **앱** → **새 앱** 클릭
3. **플랫폼**: macOS 선택
4. **앱 정보**:
   - **앱 이름**: PromptLint
   - **기본 언어**: English
   - **번들 ID**: `com.mtmd.promptlint` ← **반드시 일치**
   - **SKU**: `promptlint-0171` (고유값, 예시)
   - **사용자 접근 유형**: 전체 사용자 액세스 가능

### 1.2 코드 서명 인증서 생성

#### macOS에서 인증서 서명 요청(CSR) 생성

```bash
# Keychain Access 열기
open /Applications/Utilities/Keychain\ Access.app

# 메뉴: Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
# - User Email Address: macrothinkmicrodesign0@gmail.com
# - Common Name: PromptLint Code Signing
# - Request is: Saved to disk
# - 저장: ~/Desktop/CertificateSigningRequest.certSigningRequest
```

#### App Store Connect에서 인증서 생성

1. **Certificates, Identifiers & Profiles** 이동
2. **Certificates** → **+** (새 인증서)
3. **Mac App Distribution** 선택 (App Store용)
4. CSR 파일 업로드
5. **다운로드** → `MacAppDistribution.cer`

#### 로컬에서 인증서 설치

```bash
# 다운로드한 인증서를 Keychain에 추가
open ~/Downloads/MacAppDistribution.cer

# 인증서 확인
security find-identity -v -p codesigning | grep "Mac App Distribution"
# 출력 예:
# 1) ABCD1234567890... "Mac App Distribution: Kyeol (ABC123DEF)"
```

**인증서 ID 복사**: `ABCD1234567890...` (signing identity에 사용)
**Team ID 복사**: `ABC123DEF` (App Store Connect의 Account Settings에서도 확인 가능)

### 1.3 App ID 생성

1. **Identifiers** → **+** (새 ID)
2. **App IDs** 선택
3. **Type**: App
4. **Description**: PromptLint
5. **Bundle ID**: `com.philokalos.promptlint`
6. **Capabilities**:
   - ✅ App Sandbox (필수)
   - ✅ Network (API 통신)
   - ✅ User Selected Files (선택 파일 접근)

### 1.4 프로비저닝 프로필 생성

1. **Profiles** → **+** (새 프로필)
2. **macOS App Distribution** 선택
3. **App ID**: PromptLint 선택
4. **Certificate**: 위에서 생성한 인증서 선택
5. **Profile Name**: `PromptLint-AppStore`
6. **다운로드**:
   ```bash
   # 프로필 저장 위치
   ~/Library/MobileDevice/Provisioning\ Profiles/PromptLint-AppStore.mobileprovision
   ```

---

## 2단계: 프로젝트 설정 업데이트

### 2.1 Entitlements 파일 생성

```bash
mkdir -p desktop/certs
```

`desktop/certs/entitlements.mac.plist` 작성:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.security.app-sandbox</key>
	<true/>
	<key>com.apple.security.files.user-selected.read-write</key>
	<true/>
	<key>com.apple.security.network.client</key>
	<true/>
	<key>com.apple.security.network.server</key>
	<true/>
	<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
	<true/>
	<key>com.apple.security.cs.allow-dyld-environment-variables</key>
	<true/>
</dict>
</plist>
```

### 2.2 package.json 업데이트

`desktop/package.json` → `build` 섹션 수정:

```json
{
  "build": {
    "appId": "com.philokalos.promptlint",
    "productName": "PromptLint",
    "directories": {
      "output": "release"
    },
    "publish": {
      "provider": "github",
      "owner": "philokalos",
      "repo": "prompt-evolution",
      "releaseType": "release"
    },
    "files": [
      "dist/**/*",
      "assets/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "dist/analysis",
        "to": "analysis",
        "filter": ["**/*.cjs"]
      }
    ],
    "asar": true,
    "asarUnpack": [
      "**/*.node",
      "assets/icons/**/*"
    ],
    "mac": {
      "category": "public.app-category.developer-tools",
      "icon": "assets/icons/icon.icns",
      "entitlements": "certs/entitlements.mac.plist",
      "entitlementsInherit": "certs/entitlements.mac.plist",
      "signingIdentity": "Mac App Distribution: Kyeol (ABC123DEF)",
      "provisioningProfile": "~/Library/MobileDevice/Provisioning Profiles/PromptLint-AppStore.mobileprovision",
      "target": ["zip"],
      "type": "distribution",
      "notarize": {
        "teamId": "ABC123DEF"
      }
    }
  }
}
```

**필수 변경**:
- `signingIdentity`: 1.2 단계에서 복사한 인증서 ID
- `teamId`: App Store Connect의 Team ID
- `provisioningProfile`: 1.4 단계에서 다운로드한 프로필 경로

---

## 3단계: 빌드 및 코드 서명

### 3.1 환경 설정

```bash
cd desktop

# Apple ID 앱 전용 비밀번호 생성
# App Store Connect → 계정 설정 → 보안 → 앱 전용 비밀번호
# 생성된 비밀번호 저장: xxxx-xxxx-xxxx-xxxx

# 환경 변수 설정 (선택)
export APPLE_ID="macrothinkmicrodesign0@gmail.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABC123DEF"
```

### 3.2 서명된 앱 빌드

```bash
cd desktop

# 1. 모든 모듈 빌드
npm run build:all

# 2. electron-builder로 .pkg 생성 (자동 코드 서명)
npm run dist:mac

# 결과 확인
ls -lh release/
# PromptLint-0.1.7-arm64.pkg (또는 .dmg, .zip)
```

**코드 서명 확인**:
```bash
# 생성된 앱 검증
codesign -v -v release/PromptLint-0.1.7-arm64.pkg

# 출력 예:
# /Users/.../release/PromptLint-0.1.7-arm64.pkg: valid on disk
# /Users/.../release/PromptLint-0.1.7-arm64.pkg: satisfies its Designated Requirement
```

---

## 4단계: Notarization (필수)

Apple의 악성코드 자동 검사

### 4.1 Notarize 제출

```bash
# 방법 1: xcrun 사용 (권장)
xcrun notarytool submit release/PromptLint-0.1.7-arm64.pkg \
  --apple-id "macrothinkmicrodesign0@gmail.com" \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --team-id "ABC123DEF" \
  --wait

# 출력:
# Submitting PromptLint-0.1.7-arm64.pkg for notarization...
# id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# Processing complete
#   id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#   status: Accepted

# RequestUUID 저장: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 4.2 Notarization 상태 확인 (--wait 미사용 시)

```bash
# 상태 확인
xcrun notarytool info xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --apple-id "macrothinkmicrodesign0@gmail.com" \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --team-id "ABC123DEF"

# 출력: status: Accepted 대기 (보통 1-5분)
```

### 4.3 Staple (서명 강화)

```bash
# Notarization 완료 후, 앱에 타임스탬프 적용
xcrun stapler staple release/PromptLint-0.1.7-arm64.pkg

# 확인
xcrun stapler validate release/PromptLint-0.1.7-arm64.pkg
# The validate action worked!
```

---

## 5단계: App Store 제출

### 5.1 Transporter를 통한 제출

**Transporter 설치**:
```bash
# Mac App Store에서 "Transporter" 검색 및 설치
# 또는 직접 설치:
open "macappstore://apps.apple.com/app/transporter/id1450874784?mt=12"
```

**제출 절차**:
1. **Transporter** 앱 열기
2. **+** → `release/PromptLint-0.1.7-arm64.pkg` 선택
3. **배송** 클릭
4. Apple ID 인증
5. 제출 완료 대기

### 5.2 CLI를 통한 제출 (altool)

```bash
# 빌드 검증
xcrun altool --validate-app \
  -f release/PromptLint-0.1.7-arm64.pkg \
  -t macos \
  -u "macrothinkmicrodesign0@gmail.com" \
  -p "xxxx-xxxx-xxxx-xxxx"

# 출력: No errors validating archive

# 앱 업로드
xcrun altool --upload-app \
  -f release/PromptLint-0.1.7-arm64.pkg \
  -t macos \
  -u "macrothinkmicrodesign0@gmail.com" \
  -p "xxxx-xxxx-xxxx-xxxx"

# 출력: PromptLint uploaded successfully
```

---

## 6단계: App Store Connect 메타데이터

### 6.1 앱 정보

1. **앱 정보** 탭
   - **이름**: PromptLint
   - **부제목**: AI-powered prompt quality analysis
   - **키워드**: `prompt, ai, claude, analysis, productivity, writing, developer`
   - **설명**:
     ```
     Real-time prompt correction with AI-powered personalized learning.

     PromptLint is your AI prompt quality assistant - think of it as Grammarly for prompts.

     Features:
     • GOLDEN 6-dimension scoring (Goal, Output, Limits, Data, Evaluation, Next)
     • Real-time analysis with global hotkey (Cmd+Shift+P)
     • 3 rule-based variants + AI-powered improvements (optional)
     • IDE detection (VS Code, Cursor, JetBrains)
     • Personal learning engine with history tracking
     • Project-specific pattern recognition
     • Letter grade (A-F) with actionable suggestions

     Access PromptLint from any app. Perfect for developers, writers, and AI enthusiasts.
     ```

### 6.2 스크린샷

**필수 해상도**: 2880×1800 (15" MacBook Pro)

**권장 스크린샷** (4개):
1. **메인 분석** - GOLDEN Radar 차트 표시
2. **프롬프트 개선** - 3가지 변형 제안
3. **히스토리** - 진행 추적 및 패턴
4. **설정** - 핫키 및 커스터마이제이션

### 6.3 프리뷰 비디오 (선택)

30초 이내 짧은 데모:
- 핫키 실행
- 분석 결과 표시
- 프롬프트 개선 제안

### 6.4 버전 정보

1. **버전**: 0.1.7
2. **빌드 번호**: 1
3. **출시 정보**:
   ```
   Initial App Store Release

   PromptLint brings AI-powered prompt quality analysis to your Mac.
   ```

### 6.5 콘텐츠 등급

**앱 등급 설정** (자동):
- 일반적 대상용 (Kids, Teens, Adults)
- 폭력/범죄: 없음
- 성적 내용: 없음
- 기타: 없음

**권장**: 4+

### 6.6 개인정보보호정책

1. **개인정보보호정책 URL** 추가:
   ```
   https://github.com/philokalos/prompt-evolution/blob/main/PRIVACY.md
   ```

2. `PRIVACY.md` 작성:
   ```markdown
   # Privacy Policy for PromptLint

   Last updated: [Date]

   ## Data Collection
   - Local analysis: All prompt analysis happens on your Mac
   - Claude API calls: If AI variant is enabled, prompts are sent to Anthropic
   - No user tracking, analytics, or telemetry

   ## Data Storage
   - History stored locally in ~/.promptlint/history.db
   - No cloud synchronization
   - User fully controls data deletion

   ## Permissions
   - Accessibility: Text selection from any app
   - No microphone, camera, or contacts access

   For questions: [contact email]
   ```

### 6.7 기술 정보

- **번들 ID**: com.philokalos.promptlint
- **최소 OS**: macOS 12.0 이상
- **Apple Silicon**: 필수 (arm64)
- **인텔 Mac**: 지원하지 않음 (필요 시 추가)

---

## 7단계: 심사 및 승인

### 7.1 App Store 심사 대기

**일반적인 심사 기간**: 24-48시간

**App Store Connect에서 모니터링**:
1. **App Store Connect** → **활동** 탭
2. **심사 상태** 확인
3. 이메일로 결과 알림

### 7.2 심사 실패 시 대응

**일반적인 거절 이유**:
- ❌ 개인정보보호정책 미등록
- ❌ 앱 기능이 설명과 다름
- ❌ 코드 서명 문제
- ❌ 외부 링크/결제 방식 위반

**대응**:
1. 거절 사유 확인
2. 수정 후 새 버전 제출
3. 필요 시 Apple 지원팀에 문의

---

## 버전 업데이트 흐름

### 패치 업데이트 (0.1.7 → 0.1.8)

```bash
cd desktop

# 1. 버전 업데이트
npm version patch

# 2. 변경사항 커밋
git add -A
git commit -m "chore: bump version to 0.1.8"
git push

# 3. 빌드
npm run build:all
npm run dist:mac

# 4. Notarize
xcrun notarytool submit release/PromptLint-0.1.8-arm64.pkg \
  --apple-id "macrothinkmicrodesign0@gmail.com" \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --team-id "ABC123DEF" \
  --wait

xcrun stapler staple release/PromptLint-0.1.8-arm64.pkg

# 5. App Store 제출
# Transporter 또는 altool 사용
```

### App Store Connect 업데이트

1. **새 버전 추가** → 0.1.8
2. 메타데이터 업데이트 (필요한 경우)
3. 스크린샷 업데이트 (필요한 경우)
4. 출시 정보 작성
5. **제출** 클릭

---

## 문제 해결

| 문제 | 해결 방법 |
|------|---------|
| "코드 서명 ID 찾을 수 없음" | `security find-identity -v -p codesigning` 실행해서 정확한 이름 확인 |
| "Notarization 거절" | `xcrun notarytool log <id>` 로 상세 로그 확인 |
| "번들 ID 불일치" | `package.json`의 `appId` ↔ App Store Connect 일치 확인 |
| "이미 제출된 빌드" | `build.json`에서 빌드 번호 증가 또는 버전 변경 |
| "프로비저닝 프로필 오류" | 프로필 다시 다운로드 후 올바른 경로에 배치 |
| "앱 심사 거절" | 거절 사유 이메일 확인 후 수정 및 재제출 |

---

## 체크리스트

### Apple Developer Account
- [ ] Apple Developer Program 가입
- [ ] App Store Connect 계정 활성화

### 인증서 및 프로비저닝
- [ ] CSR 파일 생성 (Keychain Access)
- [ ] Mac App Distribution 인증서 생성 및 설치
- [ ] App ID 생성 (`com.philokalos.promptlint`)
- [ ] 프로비저닝 프로필 생성 및 다운로드

### 로컬 설정
- [ ] `entitlements.mac.plist` 생성
- [ ] `package.json` 업데이트 (signingIdentity, teamId, provisioningProfile)
- [ ] `codesign` 확인: `security find-identity -v -p codesigning`

### 빌드 및 검증
- [ ] 로컬 빌드: `npm run dist:mac`
- [ ] 코드 서명 검증: `codesign -v -v release/*.pkg`
- [ ] Notarization 성공
- [ ] Staple 완료

### App Store Connect 메타데이터
- [ ] 앱 정보 작성 (이름, 부제목, 설명, 키워드)
- [ ] 스크린샷 업로드 (4개, 2880×1800)
- [ ] 개인정보보호정책 URL 등록
- [ ] 콘텐츠 등급 설정
- [ ] 버전 정보 입력

### 제출
- [ ] Transporter 또는 altool로 제출
- [ ] App Store Connect에서 제출 확인
- [ ] 심사 상태 모니터링 (24-48시간)
- [ ] 승인 후 공개

---

## 참고 링크

- [Apple Developer Program](https://developer.apple.com/programs/)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Notarization Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Mac App Distribution Guide](https://developer.apple.com/app-store/mac/)
- [electron-builder Mac Documentation](https://www.electron.build/configuration/mac)

---

**다음 단계**: [1단계: Apple Developer Account 설정](#1단계-apple-developer-account-설정)부터 시작하세요.
