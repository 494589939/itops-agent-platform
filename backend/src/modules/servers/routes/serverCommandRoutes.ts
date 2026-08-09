/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { executeCommand, testConnection, runComplianceCheck, complianceChecks } from '../services/sshService';
import { serversRepo } from '../../../repositories/serverRepository';
import { runWithConcurrency } from '../../../utils/asyncPool';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';
import { validateBody, validateParams } from '../../../middleware/validation';
import { commonSchemas, serverCommandSchemas } from '../../../shared/schemas/apiValidation';
import { createAuditLog } from '../../audit/services/auditService';

const router = Router();

router.post('/:id/test', requireRole('admin', 'operator'), validateParams(commonSchemas.idParam), async (req: Request, res: Response) => {
  try {
    const result = await testConnection(req.params.id);
    res.json({ success: result.success, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

router.post('/:id/exec', requireRole('admin', 'operator'), validateParams(commonSchemas.idParam), validateBody(serverCommandSchemas.execCommand), async (req: Request & { user?: { id: string } }, res: Response) => {
  try {
    const { command, timeout } = req.body;
    const userId = req.user?.id || 'unknown';

    // 通过 auditService 记录命令审计（避免 routes 直访 auditLogRepository）
    createAuditLog({
      user_id: userId,
      action: 'command-execute',
      resource_type: 'server',
      resource_id: req.params.id,
      details: { command, isSafe: true, warnings: [] } as any,
    });

    const result = await executeCommand(req.params.id, command, {
      timeout,
      executedBy: userId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to execute command' });
  }
});

// ── 批量下发命令：多台服务器 + 并发数控制（异步任务，前端轮询进度）──
interface BatchTask {
  taskId: string;
  command: string;
  total: number;
  completed: number;
  successCount: number;
  failedCount: number;
  status: 'running' | 'done' | 'error';
  results: Array<{
    serverId: string;
    name: string;
    success: boolean;
    stdout: string;
    stderr: string;
    durationMs: number;
    error: string;
  }>;
  error?: string;
  createdAt: number;
}
const batchTasks = new Map<string, BatchTask>();
let batchTaskSeq = 0;

router.post('/batch', requireRole('admin', 'operator'), validateBody(serverCommandSchemas.batchExec), async (req: Request & { user?: { id: string } }, res: Response) => {
  try {
    const { serverIds, command, timeout, concurrency } = req.body;
    const userId = req.user?.id || 'unknown';
    const limit = Math.max(1, Math.min(20, concurrency || 5));
    const ids = (serverIds as string[]) || [];

    const taskId = `batch_${Date.now()}_${++batchTaskSeq}`;
    const task: BatchTask = {
      taskId,
      command,
      total: ids.length,
      completed: 0,
      successCount: 0,
      failedCount: 0,
      status: 'running',
      results: [],
      createdAt: Date.now(),
    };
    batchTasks.set(taskId, task);

    createAuditLog({
      user_id: userId,
      action: 'command-execute-batch',
      resource_type: 'server',
      resource_id: ids.join(','),
      details: { command, serverCount: ids.length, concurrency: limit, timeout: timeout || null } as any,
    });

    // 后台并发池执行，前端通过 /server-commands/batch/status/:taskId 轮询
    void (async () => {
      try {
        await runWithConcurrency(ids, limit, async (serverId) => {
          const server = serversRepo.getById(serverId) as { name?: string; hostname?: string } | undefined;
          const displayName = server?.name || server?.hostname || serverId;
          let item: BatchTask['results'][number];
          try {
            const r = await executeCommand(serverId, command, { timeout, executedBy: userId });
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
      }
    })();

    res.json({ success: true, data: { taskId } });
  } catch (err) {
    logger.error('Batch command error:', err);
    res.status(500).json({ success: false, error: '批量执行失败' });
  }
});

// 批量执行进度查询（前端轮询）
router.get('/batch/status/:taskId', (_req: Request, res: Response) => {
  const task = batchTasks.get(_req.params.taskId);
  if (!task) return res.status(404).json({ success: false, message: '任务不存在或已过期' });
  res.json({
    success: true,
    data: {
      taskId: task.taskId,
      status: task.status,
      total: task.total,
      completed: task.completed,
      successCount: task.successCount,
      failedCount: task.failedCount,
      error: task.error,
      // 结果仅在完成时返回（避免大 payload 反复传输）
      results: task.status === 'done' ? task.results : undefined,
    },
  });
});

router.get('/compliance/checks', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: complianceChecks.map((check) => ({
      name: check.name,
      command: check.command,
    })),
  });
});

router.post('/:id/compliance', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const saveResults = req.body.saveResults !== false;
    const useAI = req.body.useAI !== false;
    const concurrency = req.body.concurrency || 5;

    const results = await runComplianceCheck(req.params.id, {
      saveResults,
      useAI,
      concurrency,
    });

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Compliance check error:', error);
    res.status(500).json({ success: false, error: 'Failed to run compliance check' });
  }
});

export default router;
