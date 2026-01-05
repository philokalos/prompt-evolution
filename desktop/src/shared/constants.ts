/**
 * GOLDEN Checklist Explanations
 * Used for tooltips and help documentation
 */
export interface GoldenDimension {
  key: string;
  name: string;
  nameKo: string;
  short: string;
  detail: string;
  examples: string[];
  improvement: string;
}

export const GOLDEN_EXPLANATIONS: Record<string, GoldenDimension> = {
  G: {
    key: 'G',
    name: 'Goal',
    nameKo: '목표',
    short: '무엇을 달성하고 싶은지',
    detail: '명확한 목표 설정이 핵심입니다. "~해줘" 대신 "~를 위해 ~하는 코드 작성"처럼 구체적으로 작성하세요.',
    examples: ['버그 수정', '기능 추가', '리팩토링', '성능 최적화'],
    improvement: '목표를 구체적으로 명시하세요. 왜 이 작업이 필요한지 배경도 포함하면 좋습니다.',
  },
  O: {
    key: 'O',
    name: 'Output',
    nameKo: '출력',
    short: '어떤 형태의 결과물을 원하는지',
    detail: '원하는 출력 형식을 명확히 지정하세요. 코드, 설명, 목록, 표 등 원하는 형태를 알려주세요.',
    examples: ['TypeScript 함수', 'JSON 형식', '마크다운 표', '단계별 설명'],
    improvement: '결과물의 형식, 언어, 스타일을 명시하세요. 예: "TypeScript로 작성해주세요"',
  },
  L: {
    key: 'L',
    name: 'Limits',
    nameKo: '제약',
    short: '제약조건과 경계',
    detail: '지켜야 할 제약사항을 명시하세요. 사용할/사용하지 않을 라이브러리, 호환성 요구사항 등.',
    examples: ['외부 라이브러리 없이', 'ES6+ 문법 사용', '100줄 이내', 'IE11 지원'],
    improvement: '제약조건을 추가하세요: 버전, 성능 요구사항, 금지사항 등',
  },
  D: {
    key: 'D',
    name: 'Data',
    nameKo: '데이터',
    short: '필요한 컨텍스트와 데이터',
    detail: '작업에 필요한 배경 정보, 예시 데이터, 현재 코드 상태 등을 제공하세요.',
    examples: ['현재 코드', '에러 메시지', '입력 예시', 'API 응답 샘플'],
    improvement: '관련 코드, 에러 로그, 예시 데이터를 포함하세요. 컨텍스트가 많을수록 좋습니다.',
  },
  E: {
    key: 'E',
    name: 'Evaluation',
    nameKo: '평가',
    short: '성공 기준과 검증 방법',
    detail: '결과물이 성공적인지 판단할 기준을 제시하세요. 테스트 케이스, 성능 목표 등.',
    examples: ['테스트 통과', '타입 에러 없음', '100ms 이내 응답', '모든 엣지케이스 처리'],
    improvement: '성공 기준을 추가하세요: 테스트, 성능 목표, 품질 기준 등',
  },
  N: {
    key: 'N',
    name: 'Next',
    nameKo: '다음',
    short: '후속 단계와 맥락',
    detail: '이 작업 이후의 계획이나 전체 맥락을 공유하세요. AI가 더 적합한 솔루션을 제안할 수 있습니다.',
    examples: ['다음 단계 계획', '전체 아키텍처 설명', '사용 시나리오', '향후 확장 계획'],
    improvement: '이 작업의 맥락과 다음 단계를 알려주세요. 더 적합한 솔루션을 제안받을 수 있습니다.',
  },
};

/**
 * App Compatibility Information
 * Which apps support text selection capture vs clipboard-only
 */
export interface AppCompatibility {
  name: string;
  mode: 'full' | 'clipboard' | 'unsupported';
  note?: string;
}

export const APP_COMPATIBILITY: AppCompatibility[] = [
  // Full support
  { name: 'Safari', mode: 'full' },
  { name: 'Chrome', mode: 'full' },
  { name: 'Firefox', mode: 'full' },
  { name: 'Notes', mode: 'full' },
  { name: 'TextEdit', mode: 'full' },
  { name: 'Notion', mode: 'full' },
  { name: 'Pages', mode: 'full' },
  // Clipboard only (AppleScript blocked)
  { name: 'Cursor', mode: 'clipboard', note: '텍스트 선택 후 ⌘C 필요' },
  { name: 'VS Code', mode: 'clipboard', note: '텍스트 선택 후 ⌘C 필요' },
  { name: 'Terminal', mode: 'clipboard', note: '텍스트 선택 후 ⌘C 필요' },
  { name: 'iTerm2', mode: 'clipboard', note: '텍스트 선택 후 ⌘C 필요' },
  { name: 'Warp', mode: 'clipboard', note: '텍스트 선택 후 ⌘C 필요' },
  { name: 'Antigravity', mode: 'clipboard', note: '텍스트 선택 후 ⌘C 필요' },
  { name: 'Claude', mode: 'clipboard', note: '텍스트 선택 후 ⌘C 필요' },
];

/**
 * Shortcut formatting utilities
 */
export function formatShortcut(shortcut: string): string {
  // Convert Electron-style shortcut to display format
  return shortcut
    .replace('CommandOrControl', '⌘')
    .replace('Command', '⌘')
    .replace('Control', '⌃')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace(/\+/g, '');
}

export function shortcutToKeys(shortcut: string): string[] {
  // Convert Electron-style shortcut to array of key symbols
  const formatted = formatShortcut(shortcut);
  const keys: string[] = [];

  if (formatted.includes('⌘')) keys.push('⌘');
  if (formatted.includes('⌃')) keys.push('⌃');
  if (formatted.includes('⌥')) keys.push('⌥');
  if (formatted.includes('⇧')) keys.push('⇧');

  // Get the last character (the actual key)
  const lastChar = shortcut.split('+').pop() || '';
  if (lastChar && !['Command', 'CommandOrControl', 'Control', 'Alt', 'Shift'].includes(lastChar)) {
    keys.push(lastChar);
  }

  return keys;
}
