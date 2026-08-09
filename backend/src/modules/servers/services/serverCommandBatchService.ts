/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 批量服务器命令执行服务（route 与 MCP AI 工具共用）
 *
 * - createBatchTask: 创建任务。requireConfirmation=true 时进入 pending_approval
 *   等待人工批准后才开始执行；false 直接后台执行
 * - approveBatchTask / rejectBatchTask: 人工确认/取消
 * - getBatchTask / listPending: 状态查询（前端轮询、AI 工具、审批列表）
 */
import { executeCommand } from './sshService';
import { serversRepo } from '../../../repositories/serverRepository';
import { runWithConcurrency } from '../../../utils/asyncPool';
import { logger } from '../../../utils/logger';

export interface BatchResultItem {
  serverId: string;
  name: string;
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  error: string;
}

export interface BatchTask {
  taskId: string;
  command: string;
  serverIds: string[];
  concurrency: number;
  timeout?: number;
  total: number;
  completed: number;
  successCount: number;
  failedCount: number;
  status: 'pending_approval' | 'running' | 'done' | 'error' | 'cancelled';
  requireConfirmation: boolean;
  requestedBy: string;
  approvedBy?: string;
  results: BatchResultItem[];
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

const batchTasks = new Map<string, BatchTask>();
let batchTaskSeq = 0;

export interface CreateBatchTaskInput {
  serverIds: string[];
  command: string;
  concurrency?: number;
  timeout?: number;
  requireConfirmation?: boolean;
  requestedBy: string;
}

export const serverCommandBatchService = {
  createBatchTask(input: CreateBatchTaskInput): BatchTask {
    const ids = input.serverIds || [];
    const limit = Math.max(1, Math.min(20, input.concurrency || 5));

    const taskId = `batch_${Date.now()}_${++batchTaskSeq}`;
    const task: BatchTask = {
      taskId,
      command: input.command,
      serverIds: ids,
      concurrency: limit,
      timeout: input.timeout,
      total: ids.length,
      completed: 0,
      successCount: 0,
      failedCount: 0,
      status: input.requireConfirmation ? 'pending_approval' : 'running',
      requireConfirmation: !!input.requireConfirmation,
      requestedBy: input.requestedBy,
      results: [],
      createdAt: Date.now(),
    };
    batchTasks.set(taskId, task);

    // 需要人工确认：挂起等待 approve，不立即执行
    if (task.status === 'pending_approval') {
      logger.info(`[BatchCmd] 任务 ${taskId} 待人工确认（${ids.length} 台，${input.requestedBy} 发起）`);
      return task;
    }

    this._runTask(task);
    return task;
  },

  _runTask(task: BatchTask): void {
    void (async () => {
      task.startedAt = Date.now();
      try {
        await runWithConcurrency(task.serverIds, task.concurrency, async (serverId) => {
          const server = serversRepo.getById(serverId) as { name?: string; hostname?: string } | undefined;
          const displayName = server?.name || server?.hostname || serverId;
          let item: BatchResultItem;
          try {
            const r = await executeCommand(serverId, task.command, { timeout: task.timeout, executedBy: task.requestedBy });
            item = {
              serverId,
              name: displayName,
              success: r.success,
              stdout: r.stdout,
              stderr: r.stderr,
              durationMs: r.duration,
              error: r.success ? '' : (r.error || r.stderr || '执行失败'),
            };
          } catch (err) {
            item = {
              serverId,
              name: displayName,
              success: false,
              stdout: '',
              stderr: '',
              durationMs: 0,
              error: err instanceof Error ? err.message : String(err),
            };
          }
          task.results.push(item);
          task.completed++;
          if (item.success) task.successCount++;
          else task.failedCount++;
        });
        task.status = 'done';
      } catch (err) {
        task.status = 'error';
        task.error = err instanceof Error ? err.message : String(err);
      } finally {
        task.completedAt = Date.now();
      }
    })();
  },

  /** 人工批准后开始执行（幂等：非 pending_approval 直接返回当前态） */
  approveBatchTask(taskId: string, userId: string): BatchTask | undefined {
    const task = batchTasks.get(taskId);
    if (!task) return undefined;
    if (task.status !== 'pending_approval') return task;
    task.approvedBy = userId;
    task.status = 'running';
    logger.info(`[BatchCmd] 任务 ${taskId} 已由 ${userId} 批准执行（${task.total} 台）`);
    this._runTask(task);
    return task;
  },

  rejectBatchTask(taskId: string, userId: string): BatchTask | undefined {
    const task = batchTasks.get(taskId);
    if (!task) return undefined;
    if (task.status !== 'pending_approval') return task;
    task.status = 'cancelled';
    task.completedAt = Date.now();
    logger.info(`[BatchCmd] 任务 ${taskId} 已被 ${userId} 取消`);
    return task;
  },

  getBatchTask(taskId: string): BatchTask | undefined {
    return batchTasks.get(taskId);
  },

  listPending(): BatchTask[] {
    return Array.from(batchTasks.values())
      .filter((t) => t.status === 'pending_approval')
      .sort((a, b) => b.createdAt - a.createdAt);
  },
};

export { batchTasks };
