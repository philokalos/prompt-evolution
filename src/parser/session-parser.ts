/**
 * JSONL 파일 파싱 및 대화 구조화
 */

import { readFileSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type { 
  ClaudeCodeRecord, 
  ParsedConversation, 
  ParsedTurn,
  AssistantContentItem,
  UserRecord,
  SummaryRecord
} from '../types/index.js';
import type { AssistantRecord } from '../types/assistant.js';

const CLAUDE_PROJECTS_PATH = join(homedir(), '.claude', 'projects');

/**
 * JSONL 파일을 레코드 배열로 파싱
 */
export function parseJsonlFile(filePath: string): ClaudeCodeRecord[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const records: ClaudeCodeRecord[] = [];
  for (const line of lines) {
    try {
      const record = JSON.parse(line) as ClaudeCodeRecord;
      records.push(record);
    } catch (error) {
      // 파싱 실패한 라인은 스킵
      continue;
    }
  }
  return records;
}

/**
 * 세션 파일을 구조화된 대화로 변환
 */
export function parseSession(projectName: string, sessionFile: string): ParsedConversation | null {
  const filePath = join(CLAUDE_PROJECTS_PATH, projectName, sessionFile);
  const records = parseJsonlFile(filePath);
  
  if (records.length === 0) return null;
  
  const sessionId = basename(sessionFile, '.jsonl');
  const summaries: string[] = [];
  const turns: ParsedTurn[] = [];
  
  let model = '';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let startTime: Date | null = null;
  let endTime: Date | null = null;
  
  for (const record of records) {
    // 타임스탬프 추적
    if (record.timestamp) {
      const ts = new Date(record.timestamp);
      if (!startTime || ts < startTime) startTime = ts;
      if (!endTime || ts > endTime) endTime = ts;
    }
    
    // Summary 수집
    if (record.type === 'summary') {
      summaries.push((record as SummaryRecord).summary);
      continue;
    }
    
    // User 턴
    if (record.type === 'user') {
      const userRecord = record as UserRecord;
      turns.push({
        id: userRecord.uuid || '',
        role: 'user',
        content: userRecord.message.content,
        timestamp: new Date(userRecord.timestamp || ''),
        parentId: userRecord.parentUuid || undefined,
      });
      continue;
    }
    
    // Assistant 턴
    if (record.type === 'assistant') {
      const assistantRecord = record as AssistantRecord;
      const content = assistantRecord.message.content;
      
      // 모델 정보 추출
      if (assistantRecord.message.model && !model) {
        model = assistantRecord.message.model;
      }
      
      // 토큰 사용량 누적
      if (assistantRecord.message.usage) {
        totalInputTokens += assistantRecord.message.usage.input_tokens || 0;
        totalOutputTokens += assistantRecord.message.usage.output_tokens || 0;
      }
      
      // 콘텐츠 추출
      const textContent = extractText(content);
      const thinking = extractThinking(content);
      const toolsUsed = extractTools(content);
      
      // 텍스트 콘텐츠가 있는 경우만 턴으로 추가
      if (textContent) {
        turns.push({
          id: assistantRecord.uuid || '',
          role: 'assistant',
          content: textContent,
          timestamp: new Date(assistantRecord.timestamp || ''),
          parentId: assistantRecord.parentUuid || undefined,
          model: assistantRecord.message.model,
          thinking,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
          inputTokens: assistantRecord.message.usage?.input_tokens,
          outputTokens: assistantRecord.message.usage?.output_tokens,
        });
      }
    }
  }
  
  // 프로젝트 경로 디코딩
  const projectPath = decodeProjectPath(projectName);
  
  return {
    id: sessionId,
    project: projectName,
    projectPath,
    startedAt: startTime || new Date(),
    endedAt: endTime || new Date(),
    model,
    totalInputTokens,
    totalOutputTokens,
    turns,
    summaries,
  };
}

// 헬퍼 함수들
function extractText(content: AssistantContentItem[]): string {
  return content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
    .map(item => item.text)
    .join('\n');
}

function extractThinking(content: AssistantContentItem[]): string | undefined {
  const thinking = content.find(
    (item): item is { type: 'thinking'; thinking: string } => item.type === 'thinking'
  );
  return thinking?.thinking;
}

function extractTools(content: AssistantContentItem[]): string[] {
  return content
    .filter((item): item is { type: 'tool_use'; name: string; id: string; input: Record<string, unknown> } => 
      item.type === 'tool_use'
    )
    .map(item => item.name);
}

function decodeProjectPath(encoded: string): string {
  return encoded.replace(/-/g, '/').replace(/^\//, '');
}
