import { useState } from 'react';
import {
  Keyboard,
  MonitorSmartphone,
  Clipboard,
  Sparkles,
  MousePointer2,
  Zap,
  Code2,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Command,
  ExternalLink,
} from 'lucide-react';

interface HelpSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  details: {
    howToUse: string[];
    tips?: string[];
    shortcuts?: { keys: string[]; action: string }[];
  };
  badge?: 'essential' | 'optional' | 'advanced';
}

const helpSections: HelpSection[] = [
  {
    id: 'hotkey',
    icon: <Keyboard size={20} />,
    title: '글로벌 핫키',
    description: '어디서든 한 번의 단축키로 프롬프트 분석',
    badge: 'essential',
    details: {
      howToUse: [
        '분석하고 싶은 텍스트를 선택 (드래그)',
        '⌘⇧P (또는 설정한 단축키) 누르기',
        '선택한 텍스트가 자동으로 분석됨',
      ],
      tips: [
        '단축키는 설정에서 변경 가능 (⌥⌘P, Hyper+L 등)',
        '일부 앱에서는 텍스트 선택 후 ⌘C 복사가 필요할 수 있음',
      ],
      shortcuts: [
        { keys: ['⌘', '⇧', 'P'], action: '분석 실행 (기본값)' },
        { keys: ['Esc'], action: '창 닫기' },
      ],
    },
  },
  {
    id: 'tray',
    icon: <MonitorSmartphone size={20} />,
    title: '시스템 트레이',
    description: '메뉴바에서 빠르게 앱에 접근',
    badge: 'essential',
    details: {
      howToUse: [
        '메뉴바의 PromptLint 아이콘 확인',
        '클릭하면 분석 창이 열림/닫힘',
        '우클릭하면 메뉴 표시 (설정, 종료 등)',
      ],
      tips: [
        '더블클릭하면 클립보드 내용을 즉시 분석',
        '프롬프트가 감지되면 아이콘에 • 표시',
        '창을 닫아도 앱은 트레이에서 계속 실행됨',
      ],
    },
  },
  {
    id: 'clipboard',
    icon: <Clipboard size={20} />,
    title: '클립보드 감시',
    description: '복사한 텍스트에서 프롬프트 자동 감지',
    badge: 'optional',
    details: {
      howToUse: [
        '설정에서 "클립보드 감시" 활성화',
        '텍스트를 복사하면 자동으로 프롬프트 여부 감지',
        '프롬프트가 감지되면 트레이 아이콘에 알림 표시',
      ],
      tips: [
        '질문, 명령어, AI 관련 패턴 자동 인식',
        '비밀번호, API 키 등 민감한 정보는 자동 차단',
        '핫키를 누르면 감지된 프롬프트 바로 분석',
      ],
    },
  },
  {
    id: 'aibutton',
    icon: <Sparkles size={20} />,
    title: 'AI 컨텍스트 버튼',
    description: 'AI 앱 사용 시 분석 버튼 자동 표시',
    badge: 'optional',
    details: {
      howToUse: [
        '설정에서 "AI 컨텍스트 팝업" 활성화',
        'ChatGPT, Claude 등 AI 앱을 열면 화면 우측 하단에 버튼 표시',
        '버튼 클릭하면 클립보드 내용 즉시 분석',
      ],
      tips: [
        '버튼은 AI 앱이 활성화된 동안만 표시',
        '핫키를 기억하기 어려울 때 유용',
        '마우스를 올리면 버튼이 확대됨',
      ],
    },
  },
  {
    id: 'capture',
    icon: <MousePointer2 size={20} />,
    title: '텍스트 캡처 모드',
    description: '텍스트 가져오기 방식 선택',
    badge: 'advanced',
    details: {
      howToUse: [
        '설정에서 캡처 모드 선택:',
        '• 자동: 선택 영역 먼저 시도, 실패 시 클립보드',
        '• 선택: 선택한 텍스트만 사용',
        '• 클립보드: 복사된 내용만 사용',
      ],
      tips: [
        'VS Code, Cursor 등에서는 자동으로 클립보드 모드 사용',
        '접근성 권한이 필요한 앱이 있을 수 있음',
        '문제가 있으면 "클립보드" 모드 사용 권장',
      ],
    },
  },
  {
    id: 'variants',
    icon: <Zap size={20} />,
    title: '프롬프트 개선안',
    description: '3가지 스타일의 개선된 프롬프트 제공',
    badge: 'essential',
    details: {
      howToUse: [
        '분석 결과 하단에서 개선안 확인',
        '보수적/균형/포괄적 중 원하는 스타일 선택',
        '[적용] 버튼으로 원본 앱에 바로 적용',
      ],
      tips: [
        'API 키 설정 시 AI 기반 개선안도 제공',
        '보수적: 최소한의 변경만 적용',
        '균형: GOLDEN 체크리스트 기반 구조화',
        '포괄적: 완전한 재구성으로 최고 품질',
      ],
      shortcuts: [
        { keys: ['⌘', 'Enter'], action: '선택한 개선안 적용' },
        { keys: ['⌘', '1'], action: '보수적 버전 복사' },
        { keys: ['⌘', '2'], action: '균형 버전 복사' },
        { keys: ['⌘', '3'], action: '포괄적 버전 복사' },
        { keys: ['⌘', '4'], action: 'AI 버전 복사' },
      ],
    },
  },
  {
    id: 'ide',
    icon: <Code2 size={20} />,
    title: 'IDE 프로젝트 감지',
    description: '현재 작업 중인 프로젝트 자동 인식',
    badge: 'advanced',
    details: {
      howToUse: [
        'VS Code, Cursor, JetBrains IDE 사용 시 자동 감지',
        '분석 창 상단에 현재 프로젝트 정보 표시',
        '프로젝트별 맞춤 팁과 패턴 분석 제공',
      ],
      tips: [
        '설정에서 "프로젝트 감지 폴링" 활성화 필요',
        'Claude Code 사용 시 세션 컨텍스트도 활용',
        '기술 스택, 최근 파일, Git 브랜치 정보 표시',
      ],
    },
  },
  {
    id: 'progress',
    icon: <TrendingUp size={20} />,
    title: '진행 상황 추적',
    description: '시간에 따른 프롬프트 품질 향상 확인',
    badge: 'essential',
    details: {
      howToUse: [
        '분석 창 하단의 "내 진행 상황 보기" 클릭',
        '일별/주별/월별 점수 트렌드 확인',
        '자주 놓치는 GOLDEN 항목 파악',
      ],
      tips: [
        '평균 점수 대비 현재 분석 결과 비교',
        '취약한 차원(Goal, Output 등) 집중 개선',
        '등급 분포(A/B/C/D/F) 한눈에 확인',
      ],
    },
  },
];

function HelpView() {
  const [expandedSection, setExpandedSection] = useState<string | null>('hotkey');

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const getBadgeStyle = (badge?: string) => {
    switch (badge) {
      case 'essential':
        return 'bg-accent-primary/20 text-accent-primary';
      case 'optional':
        return 'bg-accent-secondary/20 text-accent-secondary';
      case 'advanced':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getBadgeText = (badge?: string) => {
    switch (badge) {
      case 'essential':
        return '필수';
      case 'optional':
        return '선택';
      case 'advanced':
        return '고급';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center pb-2 border-b border-dark-border">
        <h2 className="text-lg font-semibold text-gray-200">기능 안내</h2>
        <p className="text-xs text-gray-500 mt-1">
          PromptLint의 주요 기능과 사용법을 알아보세요
        </p>
      </div>

      {/* Feature List */}
      <div className="space-y-2">
        {helpSections.map((section) => (
          <div
            key={section.id}
            className="bg-dark-surface rounded-lg overflow-hidden"
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-dark-hover transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-dark-hover rounded-lg flex items-center justify-center text-accent-primary">
                {section.icon}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">
                    {section.title}
                  </span>
                  {section.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${getBadgeStyle(section.badge)}`}
                    >
                      {getBadgeText(section.badge)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {section.description}
                </p>
              </div>
              <div className="flex-shrink-0 text-gray-500">
                {expandedSection === section.id ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </div>
            </button>

            {/* Section Details */}
            {expandedSection === section.id && (
              <div className="px-3 pb-3 space-y-3 border-t border-dark-border">
                {/* How to Use */}
                <div className="pt-3">
                  <h4 className="text-xs font-medium text-gray-400 mb-2">
                    사용 방법
                  </h4>
                  <ol className="space-y-1.5">
                    {section.details.howToUse.map((step, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-xs text-gray-300"
                      >
                        {step.startsWith('•') ? (
                          <span className="text-accent-secondary ml-3">{step}</span>
                        ) : (
                          <>
                            <span className="flex-shrink-0 w-4 h-4 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-[10px]">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Tips */}
                {section.details.tips && section.details.tips.length > 0 && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5">
                    <h4 className="text-xs font-medium text-amber-400 mb-1.5">
                      💡 팁
                    </h4>
                    <ul className="space-y-1">
                      {section.details.tips.map((tip, index) => (
                        <li
                          key={index}
                          className="text-xs text-amber-300/80 flex items-start gap-1.5"
                        >
                          <span className="text-amber-500">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Shortcuts */}
                {section.details.shortcuts && section.details.shortcuts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-400 mb-2">
                      단축키
                    </h4>
                    <div className="space-y-1.5">
                      {section.details.shortcuts.map((shortcut, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, keyIndex) => (
                              <kbd
                                key={keyIndex}
                                className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                          <span className="text-gray-500">{shortcut.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Reference */}
      <div className="bg-dark-surface rounded-lg p-3 space-y-2">
        <h3 className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <Command size={12} />
          빠른 참조
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex gap-0.5">
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">⌘</kbd>
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">⇧</kbd>
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">P</kbd>
            </div>
            <span>분석</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex gap-0.5">
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">⌘</kbd>
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">↵</kbd>
            </div>
            <span>적용</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex gap-0.5">
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">Esc</kbd>
            </div>
            <span>닫기</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex gap-0.5">
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">⌘</kbd>
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">1-4</kbd>
            </div>
            <span>복사</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-2 border-t border-dark-border">
        <button
          onClick={() => {
            window.electronAPI?.openExternal?.('https://github.com/philokalos/prompt-evolution');
          }}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-accent-primary transition-colors"
        >
          <span>자세한 문서 보기</span>
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}

export default HelpView;
