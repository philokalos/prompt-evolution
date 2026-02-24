/**
 * GOLDEN for Instructions Evaluator Tests (TDD)
 *
 * Tests for evaluateInstructions() that scores CLAUDE.md-style files
 * across 6 adapted GOLDEN dimensions:
 *   Goal: project description, tech stack
 *   Output: coding conventions, style rules
 *   Limits: anti-patterns, forbidden patterns
 *   Data: file structure, environment, dependencies
 *   Evaluation: test commands, verification criteria
 *   Next: workflow, CI/CD, deployment
 *
 * Each dimension: 0-1, overallScore: 0-100, grade: A-F
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateInstructions,
  calculateGrade,
  type EvaluatorResult,
} from '../instruction-evaluator.js';
import type { ParsedSection } from '../markdown-parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function section(heading: string, content: string, level = 1): ParsedSection {
  return {
    heading,
    level,
    content,
    lineStart: 1,
    lineEnd: content.split('\n').length,
    codeBlocks: [],
    references: [],
  };
}

function sectionWithCode(
  heading: string,
  content: string,
  codeBlocks: string[],
  level = 1,
): ParsedSection {
  return { ...section(heading, content, level), codeBlocks };
}

function evaluate(sections: ParsedSection[], fullText?: string): EvaluatorResult {
  const text = fullText ?? sections.map(s => `${'#'.repeat(s.level)} ${s.heading}\n${s.content}`).join('\n\n');
  return evaluateInstructions({
    sections,
    fullText: text,
    lineCount: text.split('\n').length,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evaluateInstructions', () => {
  describe('Goal dimension (project desc / tech stack)', () => {
    it('should score high when project description and tech stack are present', () => {
      const sections = [
        section('Project Overview', 'This is a React + TypeScript web app for task management.'),
        section('Tech Stack', 'Frontend: React 18, TypeScript, Vite\nBackend: Node.js, Express'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.goal).toBeGreaterThanOrEqual(0.6);
    });

    it('should score low when no project description exists', () => {
      const sections = [
        section('Commands', 'npm run build\nnpm test'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.goal).toBeLessThan(0.4);
    });

    it('should detect tech stack keywords', () => {
      const sections = [
        section('Overview', 'Python + Django REST framework application'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.goal).toBeGreaterThan(0);
    });
  });

  describe('Output dimension (conventions / style rules)', () => {
    it('should score high when coding conventions are defined', () => {
      const sections = [
        section('Code Style', 'Use camelCase for variables.\nPrefer const over let.\nAll functions must have return types.'),
        section('Naming Conventions', 'Components use PascalCase.\nFiles use kebab-case.'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.output).toBeGreaterThanOrEqual(0.5);
    });

    it('should score low when no conventions exist', () => {
      const sections = [
        section('About', 'This is a project.'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.output).toBeLessThan(0.3);
    });

    it('should detect code example patterns', () => {
      const sections = [
        sectionWithCode('Examples', 'Always use this pattern:', ['const x: string = "foo";']),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.output).toBeGreaterThan(0);
    });
  });

  describe('Limits dimension (anti-patterns / forbidden patterns)', () => {
    it('should score high when anti-patterns are documented', () => {
      const sections = [
        section('Anti-Patterns', 'Never use any type.\nDo not use var.\nAvoid console.log in production.'),
        section('Forbidden', 'Do NOT commit .env files.\nNever use eval().'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.limits).toBeGreaterThanOrEqual(0.5);
    });

    it('should score low when no constraints exist', () => {
      const sections = [
        section('Intro', 'Welcome to the project.'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.limits).toBeLessThan(0.3);
    });

    it('should detect negative constraint keywords', () => {
      const sections = [
        section('Rules', 'Do not use any. Avoid mutations. Never skip tests.'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.limits).toBeGreaterThan(0.3);
    });
  });

  describe('Data dimension (file structure / env / dependencies)', () => {
    it('should score high when file structure and dependencies documented', () => {
      const sections = [
        section('Architecture', 'src/\n  components/\n  hooks/\n  utils/'),
        section('Dependencies', 'react: ^18.2.0\ntailwindcss: ^3.4\nvite: ^5.0'),
        section('Environment', 'ANTHROPIC_API_KEY=sk-ant-...\nDATABASE_URL=postgres://...'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.data).toBeGreaterThanOrEqual(0.5);
    });

    it('should score low when no structural info exists', () => {
      const sections = [
        section('Intro', 'Just a project.'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.data).toBeLessThan(0.3);
    });

    it('should detect file path patterns', () => {
      const sections = [
        section('Files', 'Main entry: src/index.ts\nConfig: tsconfig.json'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.data).toBeGreaterThan(0);
    });
  });

  describe('Evaluation dimension (test commands / verification)', () => {
    it('should score high when test commands and criteria documented', () => {
      const sections = [
        sectionWithCode('Testing', 'Run tests before committing:', ['npm test', 'npm run lint']),
        section('Quality', 'All PRs must pass CI.\nMinimum 80% coverage.'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.evaluation).toBeGreaterThanOrEqual(0.5);
    });

    it('should score low when no testing info exists', () => {
      const sections = [
        section('Intro', 'A web app.'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.evaluation).toBeLessThan(0.3);
    });

    it('should detect test/lint command patterns', () => {
      const sections = [
        sectionWithCode('Commands', 'Build and test:', ['npm run build && npm test']),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.evaluation).toBeGreaterThan(0);
    });
  });

  describe('Next dimension (workflow / CI/CD / deployment)', () => {
    it('should score high when workflow and CI documented', () => {
      const sections = [
        section('Workflow', '1. Create feature branch\n2. Implement changes\n3. Run tests\n4. Create PR'),
        section('Deployment', 'Deploy via GitHub Actions.\nCI runs on every push.\nStaging at staging.example.com'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.next).toBeGreaterThanOrEqual(0.5);
    });

    it('should score low when no workflow info exists', () => {
      const sections = [
        section('About', 'A simple tool.'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.next).toBeLessThan(0.3);
    });

    it('should detect CI/CD keywords', () => {
      const sections = [
        section('CI', 'GitHub Actions runs lint + test on PR.\nDeploy to Vercel on merge.'),
      ];
      const result = evaluate(sections);
      expect(result.goldenScores.next).toBeGreaterThan(0.3);
    });
  });

  describe('overall score and grade', () => {
    it('should compute overallScore as average of 6 dimensions × 100', () => {
      const sections = [
        section('Project', 'React TypeScript app'),
      ];
      const result = evaluate(sections);

      const { goal, output, limits, data, evaluation, next } = result.goldenScores;
      const expectedAvg = (goal + output + limits + data + evaluation + next) / 6;
      // overallScore = total * 100, rounded
      expect(result.overallScore).toBeCloseTo(expectedAvg * 100, 0);
    });

    it('should assign grade A for score >= 90', () => {
      expect(calculateGrade(0.95)).toBe('A');
      expect(calculateGrade(0.90)).toBe('A');
    });

    it('should assign grade B for score >= 75', () => {
      expect(calculateGrade(0.89)).toBe('B');
      expect(calculateGrade(0.75)).toBe('B');
    });

    it('should assign grade C for score >= 60', () => {
      expect(calculateGrade(0.74)).toBe('C');
      expect(calculateGrade(0.60)).toBe('C');
    });

    it('should assign grade D for score >= 40', () => {
      expect(calculateGrade(0.59)).toBe('D');
      expect(calculateGrade(0.40)).toBe('D');
    });

    it('should assign grade F for score < 40', () => {
      expect(calculateGrade(0.39)).toBe('F');
      expect(calculateGrade(0.0)).toBe('F');
    });

    it('should cap each dimension at 1.0', () => {
      // A very thorough document should not exceed 1.0 per dimension
      const richSections = [
        section('Project Overview', 'React + TypeScript + Vite web application for AI task management. Built with Node.js backend.'),
        section('Tech Stack', 'Frontend: React 18, TypeScript 5, Vite 5, Tailwind CSS\nBackend: Node.js, Express, PostgreSQL'),
        section('Code Style', 'Use camelCase. Prefer const. All functions typed. PascalCase components.'),
        section('Anti-Patterns', 'Never use any. Do not use var. Avoid eval. No console.log. Do not skip tests.'),
        section('Architecture', 'src/\n  components/\n  hooks/\n  api/\n  utils/\nConfig: tsconfig.json, vite.config.ts'),
        section('Environment', 'DATABASE_URL=postgres://...\nAPI_KEY=...'),
        section('Dependencies', 'react, typescript, vite, tailwindcss, express'),
        section('Testing', 'npm test runs Vitest.\nnpm run lint runs ESLint.\nMinimum 80% coverage.'),
        section('Workflow', '1. Branch from main\n2. Implement\n3. Test\n4. PR review\n5. Merge'),
        section('Deployment', 'GitHub Actions CI/CD.\nDeploy to Vercel.\nStaging environment available.'),
      ];
      const result = evaluate(richSections);

      expect(result.goldenScores.goal).toBeLessThanOrEqual(1.0);
      expect(result.goldenScores.output).toBeLessThanOrEqual(1.0);
      expect(result.goldenScores.limits).toBeLessThanOrEqual(1.0);
      expect(result.goldenScores.data).toBeLessThanOrEqual(1.0);
      expect(result.goldenScores.evaluation).toBeLessThanOrEqual(1.0);
      expect(result.goldenScores.next).toBeLessThanOrEqual(1.0);
      expect(result.goldenScores.total).toBeLessThanOrEqual(1.0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty sections', () => {
      const result = evaluate([], '');
      expect(result.overallScore).toBe(0);
      expect(result.grade).toBe('F');
      expect(result.goldenScores.total).toBe(0);
    });

    it('should handle preamble-only (no headings)', () => {
      const sections = [
        { heading: '', level: 0, content: 'Some text without headings.', lineStart: 1, lineEnd: 1, codeBlocks: [], references: [] },
      ];
      const result = evaluate(sections);
      expect(result.grade).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('should return all 6 dimension scores plus total', () => {
      const sections = [section('Readme', 'Hello')];
      const result = evaluate(sections);

      expect(result.goldenScores).toHaveProperty('goal');
      expect(result.goldenScores).toHaveProperty('output');
      expect(result.goldenScores).toHaveProperty('limits');
      expect(result.goldenScores).toHaveProperty('data');
      expect(result.goldenScores).toHaveProperty('evaluation');
      expect(result.goldenScores).toHaveProperty('next');
      expect(result.goldenScores).toHaveProperty('total');
    });

    it('should produce consistent grades with overallScore', () => {
      const sections = [
        section('Project', 'React app with TypeScript and Node.js backend.'),
        sectionWithCode('Commands', 'Build:', ['npm run build', 'npm test']),
        section('Rules', 'Never use any. Avoid var.'),
        section('Architecture', 'src/components/\nsrc/hooks/\nsrc/api/'),
        section('Workflow', '1. Branch\n2. Code\n3. Test\n4. PR'),
      ];
      const result = evaluate(sections);

      // Grade must match the overallScore
      const expectedGrade = calculateGrade(result.overallScore / 100);
      expect(result.grade).toBe(expectedGrade);
    });
  });

  describe('real-world pattern', () => {
    it('should score a well-structured CLAUDE.md highly', () => {
      const sections = [
        section('CLAUDE.md - My Project', 'React + TypeScript + Firebase web application for project management.'),
        sectionWithCode('Commands', 'Development and build commands:', [
          'npm run dev          # Vite dev server\nnpm run build        # Production build\nnpm test             # Vitest',
        ]),
        section('Critical Rules', '1. Always use TypeScript strict mode\n2. No any types\n3. All Firestore queries must include userId filter'),
        section('Architecture', 'src/\n  components/   # React components\n  hooks/        # Custom hooks\n  api/          # API layer\n  utils/        # Shared utilities\nConfig: tsconfig.json, vite.config.ts, firebase.json'),
        section('Anti-Patterns', '| Wrong | Correct |\n|-------|--------|\n| any type | unknown or proper type |\n| console.log | proper logging |'),
        section('Testing', 'npm test runs Vitest.\nAll PRs require passing CI.\nMinimum 80% test coverage.'),
        section('Workflow', '1. Create feature branch from main\n2. Implement changes\n3. Run npm test && npm run lint\n4. Create PR for review\n5. Deploy via GitHub Actions'),
        section('Environment', 'FIREBASE_PROJECT_ID=my-project\nANTHROPIC_API_KEY=sk-ant-...'),
      ];
      const result = evaluate(sections);

      expect(result.grade).toMatch(/^[AB]$/);
      expect(result.overallScore).toBeGreaterThanOrEqual(60);
    });

    it('should score a minimal README-like file low', () => {
      const sections = [
        section('My Project', 'A cool project I made.'),
        section('Install', 'npm install'),
        section('Usage', 'npm start'),
      ];
      const result = evaluate(sections);

      expect(result.grade).toMatch(/^[DF]$/);
      expect(result.overallScore).toBeLessThan(50);
    });
  });
});
