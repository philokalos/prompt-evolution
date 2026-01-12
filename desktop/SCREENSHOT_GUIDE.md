# App Store 스크린샷 생성 가이드

**PromptLint 스크린샷** 자동 생성 가이드

## 📋 요구사항

- 해상도: **2880×1800** (15" MacBook Pro)
- 수량: **5개**
- 언어: **한국어** (App Store Connect에서 설정)

---

## 🎯 방법 1: 정확한 비율로 앱 실행 (최신, 가장 권장)

**문제**: 임의 크기로 캡처 후 리사이즈하면 폰트가 늘어나는 현상 발생
**해결**: 앱을 정확한 16:10 비율 (1440×900)로 실행하여 레티나 디스플레이에서 자동으로 2880×1800 캡처

### 1단계: 스크린샷용 앱 실행

```bash
cd desktop
./scripts/open-for-screenshot.sh
```

**실행되는 내용**:
- 창 크기: 1440×900 (16:10 비율)
- 레티나 디스플레이 자동 2배 캡처 → 2880×1800

### 2단계: 각 화면 캡처

macOS 스크린샷 도구 사용:

1. **Cmd+Shift+4** 누르기
2. **스페이스바** 누르기 (윈도우 캡처 모드)
3. 앱 윈도우 클릭

**결과**: `~/Desktop`에 자동으로 2880×1800 PNG 생성 (리사이즈 불필요!)

### 3단계: 파일 정리

```bash
# 데스크톱의 스크린샷을 screenshots/ 폴더로 이동
mv ~/Desktop/스크린샷*.png screenshots/
cd screenshots
# 파일명 변경
mv 스크린샷*.png 1-analysis-result.png
# ... 나머지 파일들도 순서대로 변경
```

**장점**:
- ✅ 완벽한 16:10 비율 유지
- ✅ 폰트 왜곡 없음
- ✅ 레티나 자동 처리
- ✅ 리사이즈 불필요

---

## 🚀 방법 2: 완전 자동화

### 1단계: Playwright 설치

```bash
cd desktop
npm install -D playwright
```

### 2단계: Vite 개발 서버 시작

Terminal 1:
```bash
npm run dev
```

### 3단계: 자동 스크린샷 생성

Terminal 2:
```bash
npm run screenshots
```

**결과**:
- `desktop/screenshots/` 디렉토리에 5개 스크린샷 생성
- 모두 2880×1800으로 자동 리사이즈됨

---

## 🎥 방법 3: 반자동화 (가이드식)

앱을 띄우고 사용자가 각 화면을 캡처하면, 자동으로 리사이즈됩니다.

### 1단계: 앱 실행

```bash
npm run dev:electron
```

### 2단계: 스크린샷 헬퍼 실행

```bash
npm run screenshots:manual
```

### 3단계: 프롬프트 따라가기

가이드가 각 화면을 보여줍니다:
1. GOLDEN Radar 분석 화면
2. 프롬프트 3가지 변형
3. 히스토리 & 진행 추적
4. 개인화 팁
5. 설정 패널

각 화면에서 `Enter` 키를 누르면 자동으로 캡처됩니다.

---

## 👨‍💻 방법 4: 수동 캡처

가장 빠르고 정확한 방법입니다.

### 1단계: 앱 실행

```bash
npm run dev:electron
```

### 2단계: 각 화면 캡처

macOS의 스크린샷 도구 사용:

```bash
# 선택 영역 캡처 (Cmd+Shift+4로도 가능)
screencapture ~/Desktop/screenshot-1.png
```

또는 손쉽게:
1. **Cmd+Shift+4** 누르기
2. 드래그해서 영역 선택
3. 스페이스바 누르면 자동 정렬

### 3단계: 이미지 리사이즈

```bash
cd desktop
npx tsx scripts/resize-screenshots.ts ~/Desktop
```

---

## 📸 필수 스크린샷 5개

### 1. GOLDEN 분석 화면
```
PromptLint에 프롬프트 입력 후
분석 결과 표시
- GOLDEN Radar 차트
- 점수 (A-F 등급)
- 이슈 리스트
```

### 2. 프롬프트 변형 제안
```
화면을 스크롤해서 표시
- Conservative variant
- Balanced variant
- Comprehensive variant
- 각 변형의 신뢰도 표시
```

### 3. 히스토리 & 진행 추적
```
"Progress" 탭 클릭
- 점수 추세 차트
- 주간 통계
- 프로젝트별 패턴
```

### 4. 개인화 팁
```
"Tips" 탭 클릭
- 개인 학습 제안
- 약점 분석
- 개선 권고사항
```

### 5. 설정
```
설정 아이콘 클릭
- 핫키 설정
- 텍스트 캡처 모드
- API 설정
- 알림 설정
```

---

## ✅ 스크린샷 검증 체크리스트

- [ ] 5개 스크린샷 모두 생성됨
- [ ] 해상도: 2880×1800 확인
  ```bash
  identify screenshots/*.png
  ```
- [ ] 앱 UI 명확하게 보임
- [ ] 한국어 텍스트 표시됨
- [ ] 다크 배경이나 블러 없음
- [ ] 파일명: `1-*.png`, `2-*.png` ... `5-*.png`

---

## 📤 App Store Connect 업로드

1. **App Store Connect** 로그인
2. **앱 정보** → **스크린샷** 섹션
3. **언어**: 한국어 선택
4. **15" MacBook Pro** 카테고리에 5개 이미지 드래그 & 드롭
5. **저장** 클릭

---

## 🔧 스크립트: 이미지 리사이즈

수동으로 캡처한 이미지를 리사이즈하려면:

```bash
# 현재 디렉토리의 PNG 파일을 2880×1800으로 리사이즈
cd desktop
npx tsx -e "
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const dir = process.argv[2] || './screenshots';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

for (const file of files) {
  const input = path.join(dir, file);
  const output = path.join('./screenshots', file);

  sharp(input)
    .resize(2880, 1800, { fit: 'contain', background: '#fff' })
    .png()
    .toFile(output)
    .then(() => console.log('✅', file))
    .catch(err => console.error('❌', file, err));
}
" ~/Desktop
```

---

## 🐛 문제 해결

| 문제 | 해결 |
|------|------|
| "Playwright not found" | `npm install -D playwright` 실행 |
| "Cannot connect to dev server" | `npm run dev` 실행 중인지 확인 |
| "스크린샷 흐림" | 창 크기가 1440×900이 맞는지 확인 |
| "텍스트가 작음" | 2880×1800 리사이즈 확인 |

---

## 📝 참고

- App Store 스크린샷은 **최대 5개**까지만 업로드 가능
- **각 해상도별로** 따로 등록 필요 (13", 15" MacBook)
- 스크린샷은 **심사 대기 중에도 수정** 가능
- 한국 사용자에게는 한국어 스크린샷만 표시됨

---

**완료되면 App Store Connect에 업로드하세요!**
