/**
 * Personal Tips & Learning Insights Component
 * Tabbed interface combining basic tips with Phase 3 advanced analytics
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, AlertCircle, TrendingUp, BookOpen, Brain, Target } from 'lucide-react';
import IssuePatternInsights from './IssuePatternInsights';
import ImprovementImpact from './ImprovementImpact';
import LearningInsights from './LearningInsights';

interface Weakness {
  type: string;
  frequency: number;
  lastSeen: Date;
}

interface PersonalTipsProps {
  currentTips?: string[];
  className?: string;
}

type TabType = 'tips' | 'issues' | 'improvements' | 'insights';

// GOLDEN dimension keys for translation lookup: 'goalClarity', 'outputFormat',
// 'constraints', 'dataContext', 'evaluationCriteria', 'nextSteps'
// - referenced via WEAKNESS_TO_KEY mapping below

// Map weakness type (Korean) to translation key
const WEAKNESS_TO_KEY: Record<string, string> = {
  '목표 명확성': 'goalClarity',
  '출력 형식': 'outputFormat',
  '제약 조건': 'constraints',
  '데이터/컨텍스트': 'dataContext',
  '평가 기준': 'evaluationCriteria',
  '다음 단계': 'nextSteps',
};

export default function PersonalTips({ currentTips, className = '' }: PersonalTipsProps) {
  const { t } = useTranslation('analysis');
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('tips');

  useEffect(() => {
    loadWeaknesses();
  }, []);

  const loadWeaknesses = async () => {
    try {
      const data = await window.electronAPI.getTopWeaknesses(3);
      setWeaknesses(data as Weakness[]);
    } catch (error) {
      console.error('Failed to load weaknesses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get translated tips for a weakness
  const getGoldenTip = (weaknessType: string) => {
    const key = WEAKNESS_TO_KEY[weaknessType];
    if (!key) return null;

    const tipData = t(`tips.goldenTips.${key}`, { returnObjects: true }) as { name: string; icon: string; tips: string[] };
    return tipData;
  };

  // Tab configuration
  const tabs = [
    { id: 'tips' as TabType, label: t('tips.tabs.tips'), icon: Lightbulb },
    { id: 'issues' as TabType, label: t('tips.tabs.issues'), icon: AlertCircle },
    { id: 'improvements' as TabType, label: t('tips.tabs.improvements'), icon: TrendingUp },
    { id: 'insights' as TabType, label: t('tips.tabs.insights'), icon: Brain },
  ];

  const renderBasicTips = () => {
    if (loading) {
      return (
        <div className="bg-dark-surface rounded-lg p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-dark-hover rounded w-1/3"></div>
            <div className="h-3 bg-dark-hover rounded w-full"></div>
            <div className="h-3 bg-dark-hover rounded w-2/3"></div>
          </div>
        </div>
      );
    }

    // Combine current tips with weakness-based tips
    const allTips = [...(currentTips || [])];

    // Add tips based on weaknesses
    weaknesses.forEach((weakness) => {
      const goldenTip = getGoldenTip(weakness.type);
      if (goldenTip && goldenTip.tips[0]) {
        allTips.push(`${goldenTip.icon} ${goldenTip.tips[0]}`);
      }
    });

    return (
      <div className="space-y-3">
        {/* Current Tips Section */}
        {allTips.length > 0 && (
          <div className="bg-dark-surface rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Lightbulb size={16} className="text-accent-primary" />
              <span>{t('tips.customTips')}</span>
            </div>
            <div className="space-y-2">
              {allTips.slice(0, 4).map((tip, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-accent-secondary">•</span>
                  <span className="text-gray-300">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weakness Patterns Section */}
        {weaknesses.length > 0 && (
          <div className="bg-dark-surface rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Target size={16} className="text-accent-warning" />
              <span>{t('tips.frequentMisses')}</span>
            </div>
            <div className="space-y-3">
              {weaknesses.map((weakness, index) => {
                const goldenTip = getGoldenTip(weakness.type);
                return (
                  <div key={index} className="border-l-2 border-accent-warning/50 pl-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {goldenTip?.icon || '📝'} {goldenTip?.name || weakness.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {t('tips.foundCount', { count: weakness.frequency })}
                      </span>
                    </div>
                    {goldenTip && (
                      <p className="text-xs text-gray-400 mt-1">
                        {goldenTip.tips[Math.floor(Math.random() * goldenTip.tips.length)]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Improvement Tips */}
        <div className="bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 rounded-lg p-4 border border-accent-primary/20">
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <TrendingUp size={16} className="text-accent-success" />
            <span>{t('tips.improvementTips')}</span>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p>• {t('tips.improvementTip1')}</p>
            <p>• {t('tips.improvementTip2')}</p>
            <p>• {t('tips.improvementTip3')}</p>
          </div>
        </div>

        {/* Learning Resources */}
        <button className="w-full flex items-center justify-center gap-2 p-3 bg-dark-hover hover:bg-dark-border rounded-lg text-sm transition-colors">
          <BookOpen size={16} />
          <span>{t('tips.viewGuide')}</span>
        </button>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-dark-surface rounded-lg overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-accent-primary text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-hover'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'tips' && renderBasicTips()}
        {activeTab === 'issues' && <IssuePatternInsights />}
        {activeTab === 'improvements' && <ImprovementImpact />}
        {activeTab === 'insights' && <LearningInsights />}
      </div>
    </div>
  );
}
