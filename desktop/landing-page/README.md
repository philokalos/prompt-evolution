# PromptLint 랜딩 페이지

mtmd.xyz/promptlint 또는 promptlint.mtmd.xyz에 배포할 제품 마케팅 페이지입니다.

## 📁 파일 구조

```
landing-page/
├── index.html           # 자동 언어 감지 및 리다이렉트
├── ko/
│   ├── index.html      # 한국어 버전
│   └── screenshot.png  # 제품 스크린샷
├── en/
│   ├── index.html      # 영문 버전
│   └── screenshot.png  # 제품 스크린샷
└── README.md           # 이 파일
```

## 🌐 언어 지원

- **자동 감지**: 브라우저 언어를 감지하여 자동 리다이렉트
- **수동 선택**: 우측 상단 언어 전환 버튼
- **기억 기능**: localStorage에 선택한 언어 저장

**지원 언어:**
- 🇰🇷 한국어 (`/ko/`)
- 🇺🇸 영어 (`/en/`)

## 🚀 배포 방법

### 방법 1: Vercel (추천 ⭐)

**자동 설정 완료**: `vercel.json` 파일이 이미 준비되어 있습니다.

```bash
# 1. Vercel CLI 설치 (처음 한 번만)
npm i -g vercel

# 2. 로그인
cd landing-page
vercel login

# 3. 배포
vercel --prod

# 4. 도메인 연결
vercel domains add promptlint.mtmd.xyz
```

**vercel.json 설정 포함:**
- ✅ 정적 파일 빌드 설정
- ✅ 보안 헤더 (X-Frame-Options, XSS Protection)
- ✅ 캐싱 최적화 (이미지 1년, HTML 1시간)
- ✅ 클린 URL 리라이트 (/ko, /en)

### 방법 2: Netlify

1. https://netlify.com 가입
2. "Add new site" → "Import an existing project"
3. 저장소 선택
4. Build settings:
   - Base directory: `desktop/landing-page`
   - Build command: (비워두기)
   - Publish directory: `.`
5. Deploy!
6. Domain settings → Add custom domain: `promptlint.mtmd.xyz`

### 방법 3: GitHub Pages

```bash
# gh-pages 브랜치 생성 및 배포
git subtree push --prefix desktop/landing-page origin gh-pages

# Repository Settings → Pages
# Source: gh-pages branch
# Custom domain: promptlint.mtmd.xyz
```

### 방법 4: 직접 호스팅

```bash
# 파일을 웹 서버에 업로드
scp -r * user@mtmd.xyz:/var/www/html/promptlint/

# Nginx 설정 예시
location /promptlint {
    alias /var/www/html/promptlint;
    try_files $uri $uri/ /promptlint/index.html;
}
```

## 🔗 도메인 설정

### 서브도메인 (추천 ⭐)

**DNS 레코드 추가:**
```
Type: CNAME
Name: promptlint
Value: cname.vercel-dns.com  (Vercel의 경우)
TTL: Auto
```

**최종 URL:** `https://promptlint.mtmd.xyz`

### 서브디렉토리

**리버스 프록시 설정 (Nginx):**
```nginx
location /promptlint/ {
    proxy_pass https://your-vercel-url/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**최종 URL:** `https://mtmd.xyz/promptlint`

## 📝 App Store Connect 설정

랜딩 페이지 배포 완료 후:

**Support URL (필수):**
```
https://promptlint.mtmd.xyz
```

**Marketing URL (선택사항):**
```
https://promptlint.mtmd.xyz
```

## ✏️ 내용 수정

### 한국어 버전
`ko/index.html` 파일 편집:
- 기능 설명 수정
- 다운로드 링크 업데이트
- 스크린샷 교체 (`ko/screenshot.png`)

### 영문 버전
`en/index.html` 파일 편집:
- Feature descriptions
- Download links
- Screenshot replacement (`en/screenshot.png`)

### 공통 스타일 변경
색상 테마 변경 (CSS):
```css
/* 주 색상 (보라색 그라데이션) */
background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);

/* 배경색 (다크) */
background: #09090b;
```

## 📊 분석 추가 (선택사항)

### Google Analytics

각 언어 버전의 `</head>` 전에 추가:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Vercel Analytics

`vercel.json` 파일 생성:
```json
{
  "analytics": {
    "enable": true
  }
}
```

## 🎨 디자인 특징

- ✨ 다크 테마 (#09090b 배경)
- 🎨 그라데이션 액센트 (#8b5cf6 → #6366f1)
- 📱 완전 반응형 (모바일 친화적)
- ⚡ 부드러운 애니메이션 효과
- 🌐 언어 전환 버튼 (우측 상단)
- 🔄 자동 언어 감지

## 📱 로컬 테스트

### 방법 1: Python HTTP Server
```bash
cd landing-page
python3 -m http.server 8000
# http://localhost:8000 접속
```

### 방법 2: npx serve
```bash
cd landing-page
npx serve
# http://localhost:3000 접속
```

### 방법 3: VS Code Live Server
1. VS Code에서 `index.html` 열기
2. 우클릭 → "Open with Live Server"

## 🔍 SEO 최적화

각 페이지에 이미 포함된 내용:
- ✅ 메타 description
- ✅ Open Graph tags (추가 가능)
- ✅ 의미있는 alt 텍스트
- ✅ 반응형 viewport 설정

**추가 개선사항:**
```html
<!-- Open Graph (소셜 미디어 공유) -->
<meta property="og:title" content="PromptLint - AI Prompt Quality Analyzer">
<meta property="og:description" content="Learn to ask better questions to AI">
<meta property="og:image" content="https://promptlint.mtmd.xyz/screenshot.png">
<meta property="og:url" content="https://promptlint.mtmd.xyz">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="PromptLint">
<meta name="twitter:description" content="AI Prompt Quality Analyzer">
<meta name="twitter:image" content="https://promptlint.mtmd.xyz/screenshot.png">
```

## 🚦 배포 체크리스트

- [ ] GitHub에 커밋 및 푸시
- [ ] Vercel/Netlify에서 배포 완료
- [ ] 도메인 DNS 설정 (promptlint.mtmd.xyz)
- [ ] HTTPS 인증서 확인
- [ ] 한글 페이지 정상 작동 확인
- [ ] 영문 페이지 정상 작동 확인
- [ ] 언어 전환 버튼 작동 확인
- [ ] 모바일 반응형 확인
- [ ] App Store Connect URL 업데이트
- [ ] 다운로드 링크 확인

## 📞 문의

이슈나 질문이 있으시면:
- GitHub Issues: https://github.com/philokalos/prompt-evolution/issues
- Email: macrothinkmicrodesign0@gmail.com
