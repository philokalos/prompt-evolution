/**
 * Scheduler Service
 * Handles automatic data synchronization on a schedule using node-schedule
 */

import schedule from 'node-schedule';
import { importIncremental, analyzeRecent, fullRefresh } from './sync-service.js';

interface ScheduleInfo {
  name: string;
  nextInvocation: Date | null;
  lastRun: Date | null;
  isActive: boolean;
}

interface SchedulerStatus {
  isEnabled: boolean;
  schedules: ScheduleInfo[];
}

// Store scheduled jobs
const jobs: Map<string, schedule.Job> = new Map();
const lastRuns: Map<string, Date> = new Map();
let schedulerEnabled = false;

/**
 * Initialize the scheduler with default jobs
 */
export function initializeScheduler(): void {
  if (schedulerEnabled) {
    console.log('[Scheduler] Already initialized');
    return;
  }

  console.log('[Scheduler] Initializing...');

  // Every 30 minutes: Import new sessions
  const incrementalJob = schedule.scheduleJob('*/30 * * * *', async () => {
    console.log('[Scheduler] Running incremental import...');
    try {
      const result = await importIncremental();
      lastRuns.set('incremental', new Date());
      console.log(
        `[Scheduler] Incremental import complete: ${result.imported} imported, ${result.skipped} skipped`
      );
    } catch (err) {
      console.error('[Scheduler] Incremental import failed:', err);
    }
  });
  jobs.set('incremental', incrementalJob);

  // Every 2 hours: Analyze recent conversations
  const analyzeJob = schedule.scheduleJob('0 */2 * * *', async () => {
    console.log('[Scheduler] Running recent analysis...');
    try {
      const result = await analyzeRecent(24);
      lastRuns.set('analyze', new Date());
      console.log(`[Scheduler] Analysis complete: ${result.analyzed} conversations analyzed`);
    } catch (err) {
      console.error('[Scheduler] Analysis failed:', err);
    }
  });
  jobs.set('analyze', analyzeJob);

  // Daily at 3 AM: Full refresh
  const fullRefreshJob = schedule.scheduleJob('0 3 * * *', async () => {
    console.log('[Scheduler] Running full refresh...');
    try {
      const result = await fullRefresh();
      lastRuns.set('fullRefresh', new Date());
      console.log(
        `[Scheduler] Full refresh complete: ${result.imported} imported, ${result.analyzed} analyzed`
      );
    } catch (err) {
      console.error('[Scheduler] Full refresh failed:', err);
    }
  });
  jobs.set('fullRefresh', fullRefreshJob);

  schedulerEnabled = true;
  console.log('[Scheduler] Initialized with 3 scheduled jobs');
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler(): void {
  console.log('[Scheduler] Stopping all jobs...');

  for (const [name, job] of jobs) {
    job.cancel();
    console.log(`[Scheduler] Cancelled job: ${name}`);
  }

  jobs.clear();
  schedulerEnabled = false;
  console.log('[Scheduler] All jobs stopped');
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): SchedulerStatus {
  const schedules: ScheduleInfo[] = [];

  for (const [name, job] of jobs) {
    schedules.push({
      name,
      nextInvocation: job.nextInvocation() || null,
      lastRun: lastRuns.get(name) || null,
      isActive: job.nextInvocation() !== null,
    });
  }

  return {
    isEnabled: schedulerEnabled,
    schedules,
  };
}

/**
 * Get next scheduled sync time
 */
export function getNextScheduledSync(): Date | null {
  let earliest: Date | null = null;

  for (const job of jobs.values()) {
    const next = job.nextInvocation();
    if (next && (!earliest || next < earliest)) {
      earliest = next;
    }
  }

  return earliest;
}

/**
 * Manually trigger a specific job
 */
export async function triggerJob(
  jobName: 'incremental' | 'analyze' | 'fullRefresh'
): Promise<void> {
  console.log(`[Scheduler] Manually triggering job: ${jobName}`);

  switch (jobName) {
    case 'incremental':
      await importIncremental();
      break;
    case 'analyze':
      await analyzeRecent(24);
      break;
    case 'fullRefresh':
      await fullRefresh();
      break;
  }

  lastRuns.set(jobName, new Date());
}
