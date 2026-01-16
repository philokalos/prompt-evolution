/**
 * Desktop App SQLite Schema
 * PromptLint - Personal Prompt History
 */

// Base schema - tables without new columns (for backward compatibility)
export const DESKTOP_SCHEMA_BASE = `
-- Prompt Analysis History (프롬프트 분석 기록)
CREATE TABLE IF NOT EXISTS prompt_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_text TEXT NOT NULL,
  overall_score INTEGER NOT NULL,
  grade TEXT NOT NULL CHECK(grade IN ('A', 'B', 'C', 'D', 'F')),
  golden_goal INTEGER NOT NULL,
  golden_output INTEGER NOT NULL,
  golden_limits INTEGER NOT NULL,
  golden_data INTEGER NOT NULL,
  golden_evaluation INTEGER NOT NULL,
  golden_next INTEGER NOT NULL,
  issues_json TEXT,
  improved_prompt TEXT,
  source_app TEXT,
  analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Progress Snapshots (사용자 진행 스냅샷)
CREATE TABLE IF NOT EXISTS progress_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly')),
  average_score REAL NOT NULL,
  total_analyses INTEGER NOT NULL,
  top_weaknesses_json TEXT,
  score_distribution_json TEXT,
  snapshot_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period, snapshot_date)
);

-- Personal Tips Cache (개인 맞춤 팁 캐시)
CREATE TABLE IF NOT EXISTS personal_tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weakness_type TEXT NOT NULL UNIQUE,
  frequency INTEGER DEFAULT 1,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tip_text TEXT
);

-- Base indexes
CREATE INDEX IF NOT EXISTS idx_history_score ON prompt_history(overall_score);
CREATE INDEX IF NOT EXISTS idx_history_grade ON prompt_history(grade);
CREATE INDEX IF NOT EXISTS idx_history_date ON prompt_history(analyzed_at);
CREATE INDEX IF NOT EXISTS idx_progress_period ON progress_snapshots(period, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_tips_frequency ON personal_tips(frequency DESC);
`;

// Indexes for new columns (created after migration)
export const DESKTOP_SCHEMA_V2_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_history_project ON prompt_history(project_path);
CREATE INDEX IF NOT EXISTS idx_history_category ON prompt_history(category);
`;

// Full schema for new installs (includes all columns + Phase 4 tables)
export const DESKTOP_SCHEMA = `
-- Prompt Analysis History (프롬프트 분석 기록)
CREATE TABLE IF NOT EXISTS prompt_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_text TEXT NOT NULL,
  overall_score INTEGER NOT NULL,
  grade TEXT NOT NULL CHECK(grade IN ('A', 'B', 'C', 'D', 'F')),
  golden_goal INTEGER NOT NULL,
  golden_output INTEGER NOT NULL,
  golden_limits INTEGER NOT NULL,
  golden_data INTEGER NOT NULL,
  golden_evaluation INTEGER NOT NULL,
  golden_next INTEGER NOT NULL,
  issues_json TEXT,
  improved_prompt TEXT,
  source_app TEXT,
  project_path TEXT,
  intent TEXT,
  category TEXT,
  analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Progress Snapshots (사용자 진행 스냅샷)
CREATE TABLE IF NOT EXISTS progress_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly')),
  average_score REAL NOT NULL,
  total_analyses INTEGER NOT NULL,
  top_weaknesses_json TEXT,
  score_distribution_json TEXT,
  snapshot_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period, snapshot_date)
);

-- Personal Tips Cache (개인 맞춤 팁 캐시)
CREATE TABLE IF NOT EXISTS personal_tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weakness_type TEXT NOT NULL UNIQUE,
  frequency INTEGER DEFAULT 1,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tip_text TEXT
);

-- Phase 4: Project Settings (프로젝트별 설정)
CREATE TABLE IF NOT EXISTS project_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL UNIQUE,
  project_name TEXT,
  ide_type TEXT,
  preferred_variant TEXT CHECK(preferred_variant IN ('conservative', 'balanced', 'comprehensive', 'ai')),
  custom_constraints TEXT,
  custom_templates_json TEXT,
  auto_inject_context INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Phase 4: Prompt Templates (IDE별/카테고리별 템플릿)
CREATE TABLE IF NOT EXISTS prompt_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ide_type TEXT,
  category TEXT,
  template_text TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, ide_type, category)
);

-- All indexes
CREATE INDEX IF NOT EXISTS idx_history_score ON prompt_history(overall_score);
CREATE INDEX IF NOT EXISTS idx_history_grade ON prompt_history(grade);
CREATE INDEX IF NOT EXISTS idx_history_date ON prompt_history(analyzed_at);
CREATE INDEX IF NOT EXISTS idx_history_project ON prompt_history(project_path);
CREATE INDEX IF NOT EXISTS idx_history_category ON prompt_history(category);
CREATE INDEX IF NOT EXISTS idx_progress_period ON progress_snapshots(period, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_tips_frequency ON personal_tips(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_project_settings_path ON project_settings(project_path);
CREATE INDEX IF NOT EXISTS idx_templates_ide ON prompt_templates(ide_type);
CREATE INDEX IF NOT EXISTS idx_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_active ON prompt_templates(is_active);
`;

/**
 * Schema migration for existing databases
 * Adds new columns without losing data
 */
export const SCHEMA_MIGRATIONS = `
-- Add project_path column if not exists (v2)
ALTER TABLE prompt_history ADD COLUMN project_path TEXT;
ALTER TABLE prompt_history ADD COLUMN intent TEXT;
ALTER TABLE prompt_history ADD COLUMN category TEXT;
`;

/**
 * Phase 4: Project settings and templates migrations
 */
export const SCHEMA_V3_MIGRATIONS = `
-- Phase 4: Create project_settings table if not exists
CREATE TABLE IF NOT EXISTS project_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL UNIQUE,
  project_name TEXT,
  ide_type TEXT,
  preferred_variant TEXT CHECK(preferred_variant IN ('conservative', 'balanced', 'comprehensive', 'ai')),
  custom_constraints TEXT,
  custom_templates_json TEXT,
  auto_inject_context INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Phase 4: Create prompt_templates table if not exists
CREATE TABLE IF NOT EXISTS prompt_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ide_type TEXT,
  category TEXT,
  template_text TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, ide_type, category)
);

-- Create Phase 4 indexes
CREATE INDEX IF NOT EXISTS idx_project_settings_path ON project_settings(project_path);
CREATE INDEX IF NOT EXISTS idx_templates_ide ON prompt_templates(ide_type);
CREATE INDEX IF NOT EXISTS idx_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_active ON prompt_templates(is_active);
`;

export const DESKTOP_SCHEMA_VERSION = 3;
