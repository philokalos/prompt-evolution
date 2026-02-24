/**
 * Suggestion Generator
 *
 * Creates actionable fix suggestions for detected instruction issues:
 *   merge:       duplicate → consolidated single instruction
 *   resolve:     conflict → clarified, non-contradicting version
 *   add-section: missing → section template to add
 *   specify:     vague → concrete, actionable version
 *   remove:      security → redacted/placeholder version
 *   split:       excessive → split guidance with @references
 */

// =============================================================================
// Types
// =============================================================================

export type SuggestionType = 'merge' | 'resolve' | 'add-section' | 'specify' | 'remove' | 'split';

export interface InstructionSuggestion {
  issueIndex: number;
  type: SuggestionType;
  originalText?: string;
  suggestedText: string;
  description: string;
}

interface IssueInput {
  type: string;
  severity: string;
  description: string;
  location: { lineStart: number; lineEnd: number; section?: string };
  relatedLines?: string[];
}

export interface SuggestionInput {
  issues: IssueInput[];
}

// =============================================================================
// Type→Suggestion Mapping
// =============================================================================

const TYPE_TO_SUGGESTION: Record<string, SuggestionType> = {
  duplicate: 'merge',
  conflict: 'resolve',
  missing: 'add-section',
  vague: 'specify',
  security: 'remove',
  excessive: 'split',
};

// =============================================================================
// Generators
// =============================================================================

function generateMerge(issue: IssueInput, index: number): InstructionSuggestion {
  const lines = issue.relatedLines ?? [];
  const consolidated = lines[0] ?? 'Consolidated instruction';

  return {
    issueIndex: index,
    type: 'merge',
    originalText: lines.join('\n'),
    suggestedText: `Keep only one instance: "${consolidated}" and remove the duplicate.`,
    description: 'Consolidate duplicate instructions into a single location to reduce redundancy.',
  };
}

function generateResolve(issue: IssueInput, index: number): InstructionSuggestion {
  const lines = issue.relatedLines ?? [];
  const original = lines.join(' vs ');

  return {
    issueIndex: index,
    type: 'resolve',
    originalText: original || issue.description,
    suggestedText: lines.length >= 2
      ? `Choose one: either "${lines[0]}" or "${lines[1]}". If both are needed, clarify the context (e.g., "For new code: ${lines[0]}. For legacy code: ${lines[1]}").`
      : 'Resolve the contradiction by removing one instruction or adding context for when each applies.',
    description: 'Resolve conflicting instructions by choosing one or clarifying when each applies.',
  };
}

function generateAddSection(issue: IssueInput, index: number): InstructionSuggestion {
  const desc = issue.description.toLowerCase();

  if (/command|build|test/i.test(desc)) {
    return {
      issueIndex: index,
      type: 'add-section',
      suggestedText: '## Commands\n\n```bash\nnpm run dev          # Development server\nnpm run build        # Production build\nnpm test             # Run tests\nnpm run lint         # Lint check\n```',
      description: 'Add a Commands section with build, test, and development commands.',
    };
  }

  if (/project|description|overview/i.test(desc)) {
    return {
      issueIndex: index,
      type: 'add-section',
      suggestedText: '## Project Overview\n\n[Project name] is a [type] application built with [tech stack].\n\n**Purpose**: [What the project does]\n**Tech Stack**: [Languages, frameworks, tools]',
      description: 'Add a Project Overview section describing the project and its tech stack.',
    };
  }

  return {
    issueIndex: index,
    type: 'add-section',
    suggestedText: `## [Section Name]\n\n[Add relevant content here]`,
    description: 'Add the missing section with relevant content.',
  };
}

function generateSpecify(issue: IssueInput, index: number): InstructionSuggestion {
  const vagueText = issue.relatedLines?.[0] ?? '';

  // Map common vague phrases to specific alternatives
  const specifics: Record<string, string> = {
    'write good code': 'Use TypeScript strict mode. All functions must have explicit return types. Prefer const over let.',
    'make it work well': 'Ensure all edge cases are handled. Add error boundaries for async operations. Include input validation.',
    'keep things clean': 'Follow single responsibility principle. Maximum 200 lines per file. Extract shared logic into utilities.',
    'keep it clean': 'Follow single responsibility principle. Maximum 200 lines per file. Extract shared logic into utilities.',
    'keep code clean': 'Follow single responsibility principle. Maximum 200 lines per file. Extract shared logic into utilities.',
    'be careful': 'Review changes for security vulnerabilities (XSS, injection). Run tests before committing.',
    'follow best practices': 'Use ESLint with strict config. Write unit tests for new functions. Document public APIs.',
    'use common sense': 'Follow the established patterns in the codebase. When unsure, check existing implementations.',
    'do things right': 'Run the full test suite before committing. Follow the code review checklist.',
    'do it right': 'Run the full test suite before committing. Follow the code review checklist.',
    'do things properly': 'Run the full test suite before committing. Follow the code review checklist.',
    'do it properly': 'Run the full test suite before committing. Follow the code review checklist.',
  };

  const normalized = vagueText.toLowerCase().replace(/\.$/, '').trim();
  const specific = specifics[normalized] ??
    `Replace with specific, actionable instructions. For example: "Use [tool/pattern]. All [artifacts] must [criteria]."`;

  return {
    issueIndex: index,
    type: 'specify',
    originalText: vagueText,
    suggestedText: specific,
    description: 'Replace vague instruction with specific, actionable guidance.',
  };
}

function generateRemove(issue: IssueInput, index: number): InstructionSuggestion {
  return {
    issueIndex: index,
    type: 'remove',
    originalText: issue.relatedLines?.[0],
    suggestedText: 'Move secrets to .env file and use placeholder values in instructions:\n`API_KEY=your-api-key-here`',
    description: 'Remove secret from instruction file and use environment variables instead.',
  };
}

function generateSplit(issue: IssueInput, index: number): InstructionSuggestion {
  return {
    issueIndex: index,
    type: 'split',
    suggestedText: 'Split into separate files using @references:\n\n```\nCLAUDE.md          # Core rules and overview\n@.claude/rules/    # Detailed rules by category\n@.claude/patterns/ # Code patterns and examples\n```\n\nKeep the main file under 200 lines with high-level guidance, and reference detailed rules.',
    description: 'Split excessive file into focused @referenced files to reduce context rot.',
  };
}

// =============================================================================
// Main Generator
// =============================================================================

export function generateSuggestions(input: SuggestionInput): InstructionSuggestion[] {
  const suggestions: InstructionSuggestion[] = [];

  for (let i = 0; i < input.issues.length; i++) {
    const issue = input.issues[i];
    const suggestionType = TYPE_TO_SUGGESTION[issue.type];

    if (!suggestionType) continue;

    switch (suggestionType) {
      case 'merge':
        suggestions.push(generateMerge(issue, i));
        break;
      case 'resolve':
        suggestions.push(generateResolve(issue, i));
        break;
      case 'add-section':
        suggestions.push(generateAddSection(issue, i));
        break;
      case 'specify':
        suggestions.push(generateSpecify(issue, i));
        break;
      case 'remove':
        suggestions.push(generateRemove(issue, i));
        break;
      case 'split':
        suggestions.push(generateSplit(issue, i));
        break;
    }
  }

  return suggestions;
}
