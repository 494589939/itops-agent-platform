/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { executeCommand, testConnection, runComplianceCheck, complianceChecks } from '../services/sshService';
import { serverCommandBatchService } from '../services/serverCommandBatchService';
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

// ── 批量下发命令：多台服务器 + 并发数控制（异步任务，支持人工确认，前端轮询进度）──
router.post('/batch', requireRole('admin', 'operator'), validateBody(serverCommandSchemas.batchExec), async (req: Request & { user?: { id: string } }, res: Response) => {
  try {
    const { serverIds, command, timeout, concurrency, requireConfirmation } = req.body;
    const userId = req.user?.id || 'unknown';
    const ids = (serverIds as string[]) || [];

    createAuditLog({
      user_id: userId,
      action: 'command-execute-batch',
      resource_type: 'server',
      resource_id: ids.join(','),
      details: { command, serverCount: ids.length, concurrency: concurrency || 5, timeout: timeout || null, requireConfirmation: !!requireConfirmation } as any,
    });

    const task = serverCommandBatchService.createBatchTask({
      serverIds: ids,
      command,
      concurrency,
      timeout,
      requireConfirmation: requireConfirmation !== false,
      requestedBy: userId,
    });

    res.json({ success: true, data: { taskId: task.taskId, status: task.status, requireConfirmation: task.requireConfirmation } });
  } catch (err) {
    logger.error('Batch command error:', err);
    res.status(500).json({ success: false, error: '批量执行失败' });
  }
});

// 批量执行进度查询（前端轮询）
router.get('/batch/status/:taskId', (_req: Request, res: Response) => {
  const task = serverCommandBatchService.getBatchTask(_req.params.taskId);
  if (!task) return res.status(404).json({ success: false, message: '任务不存在或已过期' });
  res.json({
    success: true,
    data: {
      taskId: task.taskId,
      status: task.status,
      requireConfirmation: task.requireConfirmation,
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

// 待人工确认的批量任务列表（前端审批入口 / AI 工具）
router.get('/batch/pending', requireRole('admin', 'operator'), (_req: Request, res: Response) => {
  const tasks = serverCommandBatchService.listPending();
  res.json({
    success: true,
    data: tasks.map((t) => ({
      taskId: t.taskId,
      command: t.command,
      total: t.total,
      requireConfirmation: t.requireConfirmation,
      requestedBy: t.requestedBy,
      createdAt: t.createdAt,
    })),
  });
});

// 人工批准执行
router.post('/batch/:taskId/approve', requireRole('admin', 'operator'), async (req: Request & { user?: { id: string } }, res: Response) => {
  const task = serverCommandBatchService.approveBatchTask(req.params.taskId, req.user?.id || 'unknown');
  if (!task) return res.status(404).json({ success: false, message: '任务不存在或已过期' });
  res.json({ success: true, data: { taskId: task.taskId, status: task.status } });
});

// 取消（拒绝）执行
router.post('/batch/:taskId/reject', requireRole('admin', 'operator'), async (req: Request & { user?: { id: string } }, res: Response) => {
  const task = serverCommandBatchService.rejectBatchTask(req.params.taskId, req.user?.id || 'unknown');
  if (!task) return res.status(404).json({ success: false, message: '任务不存在或已过期' });
  res.json({ success: true, data: { taskId: task.taskId, status: task.status } });
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
