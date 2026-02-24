/**
 * CLAUDE.md Generator
 *
 * Detects a project's tech stack by scanning config files,
 * then generates a CLAUDE.md draft template tailored to that stack.
 *
 * Exported functions:
 *   detectProjectStack:    infers languages, frameworks, build tools, test frameworks
 *   generateClaudeMdDraft: produces a markdown draft with detected info
 */

import fs from 'node:fs';
import path from 'node:path';

// =============================================================================
// Types
// =============================================================================

export interface DetectedStack {
  languages: string[];
  frameworks: string[];
  buildTools: string[];
  testFrameworks: string[];
}

export interface GenerateResult {
  draft: string;
  detectedStack: DetectedStack;
  confidence: number;
}

// =============================================================================
// Config file detectors
// =============================================================================

/** Known framework names to look for in package.json dependencies. */
const FRAMEWORK_DEPS: Record<string, string> = {
  react: 'react',
  'react-dom': 'react',
  vue: 'vue',
  '@angular/core': 'angular',
  svelte: 'svelte',
  next: 'next',
  nuxt: 'nuxt',
  express: 'express',
  fastify: 'fastify',
  koa: 'koa',
  nestjs: 'nestjs',
  '@nestjs/core': 'nestjs',
  electron: 'electron',
};

/** Known build tools in devDependencies. */
const BUILD_TOOL_DEPS: Record<string, string> = {
  vite: 'vite',
  webpack: 'webpack',
  esbuild: 'esbuild',
  rollup: 'rollup',
  parcel: 'parcel',
  turbopack: 'turbopack',
  'ts-node': 'ts-node',
  tsx: 'tsx',
};

/** Known test frameworks in devDependencies. */
const TEST_FRAMEWORK_DEPS: Record<string, string> = {
  vitest: 'vitest',
  jest: 'jest',
  mocha: 'mocha',
  '@playwright/test': 'playwright',
  playwright: 'playwright',
  cypress: 'cypress',
};

/** Python framework patterns in requirements.txt / pyproject.toml. */
const PYTHON_FRAMEWORKS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bdjango\b/i, name: 'django' },
  { pattern: /\bflask\b/i, name: 'flask' },
  { pattern: /\bfastapi\b/i, name: 'fastapi' },
];

/** Python test framework patterns. */
const PYTHON_TEST_FRAMEWORKS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bpytest\b/i, name: 'pytest' },
  { pattern: /\bunittest\b/i, name: 'unittest' },
];

// =============================================================================
// Stack Detection
// =============================================================================

/**
 * Safely read a file, returning empty string on failure.
 */
function safeReadFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Safely check if a file exists.
 */
function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Parse package.json and extract framework/tool/test detections.
 */
function detectFromPackageJson(projectPath: string, stack: DetectedStack): void {
  const pkgPath = path.join(projectPath, 'package.json');
  if (!fileExists(pkgPath)) return;

  // Even if parse fails, we know it's at least a JS project
  const content = safeReadFile(pkgPath);
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(content) as Record<string, unknown>;
  } catch {
    // Malformed package.json — still a JS project
    if (!stack.languages.includes('javascript')) {
      stack.languages.push('javascript');
    }
    return;
  }

  // TypeScript detection via tsconfig
  const hasTsConfig = fileExists(path.join(projectPath, 'tsconfig.json'));
  if (hasTsConfig) {
    if (!stack.languages.includes('typescript')) {
      stack.languages.push('typescript');
    }
  } else {
    if (!stack.languages.includes('javascript')) {
      stack.languages.push('javascript');
    }
  }

  // Scan dependencies for frameworks
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  for (const [depName, frameworkName] of Object.entries(FRAMEWORK_DEPS)) {
    if (depName in deps && !stack.frameworks.includes(frameworkName)) {
      stack.frameworks.push(frameworkName);
    }
  }

  // Scan devDependencies for build tools + test frameworks
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;

  // Also check dependencies for frameworks that may be listed there
  const allDeps = { ...deps, ...devDeps };

  for (const [depName, frameworkName] of Object.entries(FRAMEWORK_DEPS)) {
    if (depName in allDeps && !stack.frameworks.includes(frameworkName)) {
      stack.frameworks.push(frameworkName);
    }
  }

  for (const [depName, toolName] of Object.entries(BUILD_TOOL_DEPS)) {
    if (depName in devDeps && !stack.buildTools.includes(toolName)) {
      stack.buildTools.push(toolName);
    }
  }

  for (const [depName, testName] of Object.entries(TEST_FRAMEWORK_DEPS)) {
    if (depName in devDeps && !stack.testFrameworks.includes(testName)) {
      stack.testFrameworks.push(testName);
    }
  }
}

/**
 * Parse Python config files (requirements.txt, pyproject.toml).
 */
function detectFromPython(projectPath: string, stack: DetectedStack): void {
  const reqPath = path.join(projectPath, 'requirements.txt');
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');

  const hasReq = fileExists(reqPath);
  const hasPyproject = fileExists(pyprojectPath);

  if (!hasReq && !hasPyproject) return;

  if (!stack.languages.includes('python')) {
    stack.languages.push('python');
  }

  // Read content from whichever files exist
  const content = [
    hasReq ? safeReadFile(reqPath) : '',
    hasPyproject ? safeReadFile(pyprojectPath) : '',
  ].join('\n');

  // Detect frameworks
  for (const { pattern, name } of PYTHON_FRAMEWORKS) {
    if (pattern.test(content) && !stack.frameworks.includes(name)) {
      stack.frameworks.push(name);
    }
  }

  // Detect test frameworks
  for (const { pattern, name } of PYTHON_TEST_FRAMEWORKS) {
    if (pattern.test(content) && !stack.testFrameworks.includes(name)) {
      stack.testFrameworks.push(name);
    }
  }
}

/**
 * Detect Rust project from Cargo.toml.
 */
function detectFromCargo(projectPath: string, stack: DetectedStack): void {
  const cargoPath = path.join(projectPath, 'Cargo.toml');
  if (!fileExists(cargoPath)) return;

  if (!stack.languages.includes('rust')) {
    stack.languages.push('rust');
  }
  if (!stack.buildTools.includes('cargo')) {
    stack.buildTools.push('cargo');
  }
}

/**
 * Detect Go project from go.mod.
 */
function detectFromGoMod(projectPath: string, stack: DetectedStack): void {
  const goModPath = path.join(projectPath, 'go.mod');
  if (!fileExists(goModPath)) return;

  if (!stack.languages.includes('go')) {
    stack.languages.push('go');
  }
}

/**
 * Scan a project directory and return the detected tech stack.
 */
export function detectProjectStack(projectPath: string): DetectedStack {
  const stack: DetectedStack = {
    languages: [],
    frameworks: [],
    buildTools: [],
    testFrameworks: [],
  };

  detectFromPackageJson(projectPath, stack);
  detectFromPython(projectPath, stack);
  detectFromCargo(projectPath, stack);
  detectFromGoMod(projectPath, stack);

  return stack;
}

// =============================================================================
// Draft Generation
// =============================================================================

/**
 * Count total detected items across all stack categories.
 */
function countDetectedItems(stack: DetectedStack): number {
  return (
    stack.languages.length +
    stack.frameworks.length +
    stack.buildTools.length +
    stack.testFrameworks.length
  );
}

/**
 * Generate the Commands section based on the detected stack.
 */
function generateCommandsSection(stack: DetectedStack): string {
  const commands: string[] = [];

  const hasNode = stack.languages.includes('javascript') || stack.languages.includes('typescript');
  const hasRust = stack.languages.includes('rust');
  const hasGo = stack.languages.includes('go');
  const hasPython = stack.languages.includes('python');

  if (hasNode) {
    commands.push('npm install            # Install dependencies');
    commands.push('npm run dev            # Development server');
    commands.push('npm run build          # Production build');
    if (stack.testFrameworks.some(t => ['vitest', 'jest', 'mocha'].includes(t))) {
      commands.push('npm test               # Run tests');
    }
    if (stack.buildTools.includes('vite')) {
      commands.push('npm run preview        # Preview production build');
    }
  }

  if (hasRust) {
    commands.push('cargo build            # Build project');
    commands.push('cargo run              # Run project');
    commands.push('cargo test             # Run tests');
    commands.push('cargo clippy           # Lint');
    commands.push('cargo fmt              # Format code');
  }

  if (hasGo) {
    commands.push('go build ./...         # Build all packages');
    commands.push('go run .               # Run project');
    commands.push('go test ./...          # Run tests');
    commands.push('go vet ./...           # Lint');
  }

  if (hasPython) {
    commands.push('pip install -r requirements.txt  # Install dependencies');
    commands.push('python -m pytest                 # Run tests');
    if (stack.frameworks.includes('django')) {
      commands.push('python manage.py runserver       # Development server');
    }
    if (stack.frameworks.includes('flask')) {
      commands.push('flask run                        # Development server');
    }
    if (stack.frameworks.includes('fastapi')) {
      commands.push('uvicorn main:app --reload        # Development server');
    }
  }

  if (commands.length === 0) {
    commands.push('# TODO: Add your build/dev/test commands here');
  }

  return commands.join('\n');
}

/**
 * Generate a stack summary line.
 */
function generateStackSummary(stack: DetectedStack): string {
  const parts: string[] = [];

  if (stack.languages.length > 0) {
    parts.push(`**Languages**: ${stack.languages.join(', ')}`);
  }
  if (stack.frameworks.length > 0) {
    parts.push(`**Frameworks**: ${stack.frameworks.join(', ')}`);
  }
  if (stack.buildTools.length > 0) {
    parts.push(`**Build Tools**: ${stack.buildTools.join(', ')}`);
  }
  if (stack.testFrameworks.length > 0) {
    parts.push(`**Test Frameworks**: ${stack.testFrameworks.join(', ')}`);
  }

  if (parts.length === 0) {
    return '> TODO: Describe your tech stack here.';
  }

  return parts.join('\n');
}

/**
 * Generate a CLAUDE.md draft from the detected project stack.
 */
export function generateClaudeMdDraft(projectPath: string): GenerateResult {
  const projectName = path.basename(projectPath);
  const detectedStack = detectProjectStack(projectPath);

  const totalItems = countDetectedItems(detectedStack);
  const confidence = Math.min(totalItems / 10, 1.0);

  const draft = `# CLAUDE.md - ${projectName}

> TODO: Briefly describe what this project does.

${generateStackSummary(detectedStack)}

## Commands

\`\`\`bash
${generateCommandsSection(detectedStack)}
\`\`\`

## Architecture

> TODO: Describe the project structure and key directories.

\`\`\`
${projectName}/
\u251C\u2500\u2500 src/          # Source code
\u251C\u2500\u2500 tests/        # Tests
\u2514\u2500\u2500 ...
\`\`\`

## Key Patterns

| Pattern | Details |
|---------|---------|
| TODO    | Describe key patterns used in this project |

## Anti-Patterns

| Wrong | Correct |
|-------|---------|
| TODO  | Describe what to avoid and the correct approach |
`;

  return {
    draft,
    detectedStack,
    confidence,
  };
}
