/**
 * Projects Command
 * List all Claude Code projects
 */

import { listProjects, listSessions } from '../../parser/index.js';

export function projectsCommand(): void {
  console.log('\n📁 Claude Code 프로젝트 목록\n');
  const projects = listProjects();

  if (projects.length === 0) {
    console.log('프로젝트가 없습니다.');
    return;
  }

  projects.forEach((project, i) => {
    const sessions = listSessions(project);
    const decoded = project.replace(/-/g, '/').replace(/^\//, '');
    console.log(`${i + 1}. ${decoded}`);
    console.log(`   세션: ${sessions.length}개`);
    console.log(`   ID: ${project}\n`);
  });

  console.log(`총 ${projects.length}개 프로젝트`);
}
