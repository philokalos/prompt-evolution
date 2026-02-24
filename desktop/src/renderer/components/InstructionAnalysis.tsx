/**
 * InstructionAnalysis Component
 *
 * Displays CLAUDE.md linter results:
 *   - GOLDEN radar chart (instruction dimensions)
 *   - Issue list by severity
 *   - Suggestion cards
 *   - Overall score and grade
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Shield,
  FileText,
  Lightbulb,
} from 'lucide-react';
import GoldenRadar from './GoldenRadar.js';
import type { InstructionAnalysisResult } from '../hooks/useInstructionLinter.js';

interface InstructionAnalysisProps {
  analysis: InstructionAnalysisResult;
}

const SEVERITY_ICONS: Record<string, typeof AlertTriangle> = {
  critical: Shield,
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-blue-400',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/20',
  high: 'bg-orange-500/10 border-orange-500/20',
  medium: 'bg-yellow-500/10 border-yellow-500/20',
  low: 'bg-blue-400/10 border-blue-400/20',
};

export default function InstructionAnalysis({ analysis }: InstructionAnalysisProps) {
  const { t } = useTranslation('analysis');

  // Build dimension labels for instruction mode
  const dimensionLabels = useMemo(() => ({
    goal: t('instructionLinter.dimensions.goal'),
    goalDesc: t('instructionLinter.dimensions.goalDesc'),
    output: t('instructionLinter.dimensions.output'),
    outputDesc: t('instructionLinter.dimensions.outputDesc'),
    limits: t('instructionLinter.dimensions.limits'),
    limitsDesc: t('instructionLinter.dimensions.limitsDesc'),
    data: t('instructionLinter.dimensions.data'),
    dataDesc: t('instructionLinter.dimensions.dataDesc'),
    evaluation: t('instructionLinter.dimensions.evaluation'),
    evaluationDesc: t('instructionLinter.dimensions.evaluationDesc'),
    next: t('instructionLinter.dimensions.next'),
    nextDesc: t('instructionLinter.dimensions.nextDesc'),
  }), [t]);

  // Convert 0-1 scores to 0-100 for radar chart
  const radarScores = useMemo(() => ({
    goal: Math.round(analysis.goldenScores.goal * 100),
    output: Math.round(analysis.goldenScores.output * 100),
    limits: Math.round(analysis.goldenScores.limits * 100),
    data: Math.round(analysis.goldenScores.data * 100),
    evaluation: Math.round(analysis.goldenScores.evaluation * 100),
    next: Math.round(analysis.goldenScores.next * 100),
  }), [analysis.goldenScores]);

  const gradeColor = useMemo(() => {
    switch (analysis.grade) {
      case 'A': return 'text-green-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-yellow-400';
      case 'D': return 'text-orange-400';
      default: return 'text-red-400';
    }
  }, [analysis.grade]);

  return (
    <div className="space-y-4">
      {/* Score Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-indigo-400" />
          <div>
            <h2 className="text-lg font-bold text-white">
              {t('instructionLinter.title')}
            </h2>
            <p className="text-xs text-gray-500">
              {t(`instructionLinter.fileFormats.${analysis.fileFormat}`)} &middot; {analysis.lineCount} lines
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${gradeColor}`}>
            {analysis.grade}
          </div>
          <div className="text-sm text-gray-400">
            {analysis.overallScore}/100
          </div>
        </div>
      </div>

      {/* GOLDEN Radar */}
      <div className="flex justify-center py-2">
        <GoldenRadar
          scores={radarScores}
          size={180}
          dimensionLabels={dimensionLabels}
        />
      </div>

      {/* Issues */}
      {analysis.issues.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <AlertTriangle size={14} />
            {t('instructionLinter.issues')} ({analysis.issues.length})
          </h3>
          {analysis.issues.map((issue, idx) => {
            const Icon = SEVERITY_ICONS[issue.severity] ?? Info;
            return (
              <div
                key={idx}
                className={`border rounded-lg p-3 ${SEVERITY_BG[issue.severity] ?? ''}`}
              >
                <div className="flex items-start gap-2">
                  <Icon
                    size={14}
                    className={`mt-0.5 flex-shrink-0 ${SEVERITY_COLORS[issue.severity] ?? ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-medium ${SEVERITY_COLORS[issue.severity] ?? ''}`}>
                        {t(`instructionLinter.severity.${issue.severity}`)}
                      </span>
                      <span className="text-gray-500">
                        {t(`instructionLinter.issueTypes.${issue.type}`)}
                      </span>
                      {issue.location.lineStart > 0 && (
                        <span className="text-gray-600 ml-auto">
                          L{issue.location.lineStart}
                          {issue.location.lineEnd > issue.location.lineStart && `-${issue.location.lineEnd}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-300 mt-1">
                      {issue.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500 text-sm">
          {t('instructionLinter.noIssues')}
        </div>
      )}

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Lightbulb size={14} />
            {t('instructionLinter.suggestions')} ({analysis.suggestions.length})
          </h3>
          {analysis.suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="border border-indigo-500/20 bg-indigo-500/5 rounded-lg p-3"
            >
              <p className="text-xs text-gray-400 mb-1">
                {suggestion.description}
              </p>
              {suggestion.originalText && (
                <div className="text-xs bg-red-500/10 text-red-300 rounded px-2 py-1 mb-1 font-mono">
                  - {suggestion.originalText}
                </div>
              )}
              <div className="text-xs bg-green-500/10 text-green-300 rounded px-2 py-1 font-mono whitespace-pre-wrap">
                + {suggestion.suggestedText}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
