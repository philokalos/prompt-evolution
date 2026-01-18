/**
 * Project Settings & Templates Repository
 * Phase 4: IDE-optimized workflows and project-specific configurations
 */

import { getDatabase } from './connection.js';

// Project settings interface
export interface ProjectSettings {
  id?: number;
  projectPath: string;
  projectName?: string;
  ideType?: string;
  preferredVariant?: 'conservative' | 'balanced' | 'comprehensive' | 'ai';
  customConstraints?: string;
  customTemplates?: CustomTemplate[];
  autoInjectContext?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomTemplate {
  name: string;
  trigger: string;
  template: string;
}

// Prompt template interface
export interface PromptTemplate {
  id?: number;
  name: string;
  ideType?: string;
  category?: string;
  templateText: string;
  description?: string;
  isActive?: boolean;
  usageCount?: number;
  createdAt?: Date;
}

// Database row types (snake_case columns)
interface ProjectSettingsRow {
  id: number;
  project_path: string;
  project_name: string | null;
  ide_type: string | null;
  preferred_variant: string | null;
  custom_constraints: string | null;
  custom_templates_json: string | null;
  auto_inject_context: number;
  created_at: string;
  updated_at: string;
}

interface PromptTemplateRow {
  id: number;
  name: string;
  ide_type: string | null;
  category: string | null;
  template_text: string;
  description: string | null;
  is_active: number;
  usage_count: number;
  created_at: string;
}

/** Convert database row to PromptTemplate */
function rowToTemplate(row: PromptTemplateRow): PromptTemplate {
  return {
    id: row.id,
    name: row.name,
    ideType: row.ide_type ?? undefined,
    category: row.category ?? undefined,
    templateText: row.template_text,
    description: row.description ?? undefined,
    isActive: Boolean(row.is_active),
    usageCount: row.usage_count,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Get project settings by path
 */
export function getProjectSettings(projectPath: string): ProjectSettings | null {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM project_settings
    WHERE project_path = ?
  `);

  const row = stmt.get(projectPath) as ProjectSettingsRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    projectPath: row.project_path,
    projectName: row.project_name ?? undefined,
    ideType: row.ide_type ?? undefined,
    preferredVariant: row.preferred_variant as ProjectSettings['preferredVariant'],
    customConstraints: row.custom_constraints ?? undefined,
    customTemplates: row.custom_templates_json
      ? JSON.parse(row.custom_templates_json)
      : [],
    autoInjectContext: Boolean(row.auto_inject_context),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Save or update project settings
 */
export function saveProjectSettings(settings: ProjectSettings): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO project_settings (
      project_path, project_name, ide_type, preferred_variant,
      custom_constraints, custom_templates_json, auto_inject_context,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(project_path) DO UPDATE SET
      project_name = excluded.project_name,
      ide_type = excluded.ide_type,
      preferred_variant = excluded.preferred_variant,
      custom_constraints = excluded.custom_constraints,
      custom_templates_json = excluded.custom_templates_json,
      auto_inject_context = excluded.auto_inject_context,
      updated_at = datetime('now')
  `);

  stmt.run(
    settings.projectPath,
    settings.projectName || null,
    settings.ideType || null,
    settings.preferredVariant || null,
    settings.customConstraints || null,
    settings.customTemplates
      ? JSON.stringify(settings.customTemplates)
      : null,
    settings.autoInjectContext ? 1 : 0
  );
}

/**
 * Delete project settings
 */
export function deleteProjectSettings(projectPath: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM project_settings WHERE project_path = ?`);
  stmt.run(projectPath);
}

/**
 * Get all templates (optionally filtered by IDE or category)
 */
export function getTemplates(options?: {
  ideType?: string;
  category?: string;
  activeOnly?: boolean;
}): PromptTemplate[] {
  const db = getDatabase();

  let query = `SELECT * FROM prompt_templates WHERE 1=1`;
  const params: (string | number)[] = [];

  if (options?.ideType) {
    query += ` AND (ide_type = ? OR ide_type IS NULL)`;
    params.push(options.ideType);
  }

  if (options?.category) {
    query += ` AND (category = ? OR category IS NULL)`;
    params.push(options.category);
  }

  if (options?.activeOnly) {
    query += ` AND is_active = 1`;
  }

  query += ` ORDER BY usage_count DESC, name ASC`;

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as PromptTemplateRow[];

  return rows.map(rowToTemplate);
}

/**
 * Get a single template by ID or name
 */
export function getTemplate(idOrName: number | string): PromptTemplate | null {
  const db = getDatabase();

  const stmt = typeof idOrName === 'number'
    ? db.prepare(`SELECT * FROM prompt_templates WHERE id = ?`)
    : db.prepare(`SELECT * FROM prompt_templates WHERE name = ?`);

  const row = stmt.get(idOrName) as PromptTemplateRow | undefined;
  if (!row) return null;

  return rowToTemplate(row);
}

/**
 * Save or update template
 */
export function saveTemplate(template: PromptTemplate): number {
  const db = getDatabase();

  if (template.id) {
    // Update existing
    const stmt = db.prepare(`
      UPDATE prompt_templates SET
        name = ?,
        ide_type = ?,
        category = ?,
        template_text = ?,
        description = ?,
        is_active = ?
      WHERE id = ?
    `);

    stmt.run(
      template.name,
      template.ideType || null,
      template.category || null,
      template.templateText,
      template.description || null,
      template.isActive ? 1 : 0,
      template.id
    );

    return template.id;
  } else {
    // Insert new
    const stmt = db.prepare(`
      INSERT INTO prompt_templates (
        name, ide_type, category, template_text, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(name, ide_type, category) DO UPDATE SET
        template_text = excluded.template_text,
        description = excluded.description,
        is_active = excluded.is_active
    `);

    const result = stmt.run(
      template.name,
      template.ideType || null,
      template.category || null,
      template.templateText,
      template.description || null,
      template.isActive !== false ? 1 : 0
    );

    return result.lastInsertRowid as number;
  }
}

/**
 * Increment template usage count
 */
export function incrementTemplateUsage(templateId: number): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE prompt_templates
    SET usage_count = usage_count + 1
    WHERE id = ?
  `);
  stmt.run(templateId);
}

/**
 * Delete template
 */
export function deleteTemplate(id: number): void {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM prompt_templates WHERE id = ?`);
  stmt.run(id);
}

/**
 * Initialize default templates for common IDEs and categories
 */
export function initializeDefaultTemplates(): void {
  const defaultTemplates: Omit<PromptTemplate, 'id' | 'createdAt' | 'usageCount'>[] = [
    // VS Code templates
    {
      name: 'VS Code TypeScript Component',
      ideType: 'vscode',
      category: 'code-generation',
      templateText: `Create a React TypeScript component with the following requirements:

**Component Name**: [name]
**Purpose**: [purpose]
**Props Interface**: [props]

**Requirements**:
- Use TypeScript with strict typing
- Follow React best practices
- Include proper JSDoc comments
- Export as named export

**Constraints**:
- No external dependencies beyond React
- Keep component under 200 lines`,
      description: 'Template for creating React TypeScript components in VS Code',
      isActive: true,
    },
    {
      name: 'Cursor Pair Programming',
      ideType: 'cursor',
      category: 'code-generation',
      templateText: `I'm working on [feature/task]. Let's collaborate on this step by step.

**Current Context**:
- File: [filename]
- Language: [language]
- Framework: [framework]

**What I need**:
[detailed description]

**Approach Preference**:
[preferred approach or let me know options]

Please explain your reasoning as you code and ask clarifying questions if needed.`,
      description: 'Optimized for Cursor AI pair programming workflow',
      isActive: true,
    },
    {
      name: 'JetBrains Refactoring',
      ideType: 'jetbrains',
      category: 'refactoring',
      templateText: `Refactor the following code while maintaining the existing functionality:

**Target**: [class/method/module]
**Language**: [Kotlin/Java/etc]

**Refactoring Goals**:
- Improve readability
- Follow [language] best practices
- Maintain test compatibility

**Code**:
\`\`\`[language]
[code to refactor]
\`\`\`

**Constraints**:
- Keep existing public API
- No breaking changes
- Preserve performance characteristics`,
      description: 'Template for refactoring in JetBrains IDEs',
      isActive: true,
    },
    // Category-based templates
    {
      name: 'Bug Fix Analysis',
      category: 'bug-fix',
      templateText: `Analyze and fix the following bug:

**Bug Description**:
[description of the bug]

**Steps to Reproduce**:
1. [step 1]
2. [step 2]
...

**Expected Behavior**:
[what should happen]

**Actual Behavior**:
[what actually happens]

**Relevant Code**:
\`\`\`[language]
[code snippet]
\`\`\`

**Requirements**:
- Identify root cause
- Propose fix with explanation
- Suggest tests to prevent regression`,
      description: 'Structured template for bug fix requests',
      isActive: true,
    },
    {
      name: 'Code Review Request',
      category: 'code-review',
      templateText: `Please review the following code:

**Purpose**: [what this code does]
**Language/Framework**: [language/framework]

**Focus Areas**:
- [ ] Security vulnerabilities
- [ ] Performance issues
- [ ] Code style and best practices
- [ ] Test coverage
- [ ] Edge cases

**Code**:
\`\`\`[language]
[code to review]
\`\`\`

**Specific Questions**:
[any specific concerns or questions]`,
      description: 'Template for requesting code reviews',
      isActive: true,
    },
  ];

  for (const template of defaultTemplates) {
    try {
      saveTemplate(template);
    } catch (error) {
      console.warn(`[DB] Failed to save default template "${template.name}":`, error);
    }
  }

  console.log(`[DB] Initialized ${defaultTemplates.length} default templates`);
}

/**
 * Get recommended template based on context
 */
export function getRecommendedTemplate(context: {
  ideType?: string;
  category?: string;
  projectPath?: string;
}): PromptTemplate | null {
  const db = getDatabase();

  // Try to find exact match (IDE + category)
  if (context.ideType && context.category) {
    const stmt = db.prepare(`
      SELECT * FROM prompt_templates
      WHERE ide_type = ? AND category = ? AND is_active = 1
      ORDER BY usage_count DESC
      LIMIT 1
    `);
    const row = stmt.get(context.ideType, context.category) as PromptTemplateRow | undefined;
    if (row) {
      return rowToTemplate(row);
    }
  }

  // Fallback to category-only match
  if (context.category) {
    const stmt = db.prepare(`
      SELECT * FROM prompt_templates
      WHERE category = ? AND is_active = 1
      ORDER BY usage_count DESC
      LIMIT 1
    `);
    const row = stmt.get(context.category) as PromptTemplateRow | undefined;
    if (row) {
      return rowToTemplate(row);
    }
  }

  // Fallback to IDE-only match
  if (context.ideType) {
    const stmt = db.prepare(`
      SELECT * FROM prompt_templates
      WHERE ide_type = ? AND is_active = 1
      ORDER BY usage_count DESC
      LIMIT 1
    `);
    const row = stmt.get(context.ideType) as PromptTemplateRow | undefined;
    if (row) {
      return rowToTemplate(row);
    }
  }

  return null;
}
