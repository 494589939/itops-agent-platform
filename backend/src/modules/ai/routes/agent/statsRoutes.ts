/**
 * Agent 统计 routes（2026-07-21 拆分，2026-07-23 清理死路由）
 *
 * 仅保留 GET /stats/summary（前端 Agents.tsx 调用）；
 * GET /:id/test-input 已删除（前端无消费者）。
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../../utils/logger';
import { agentCrudService } from '../../services/agentCrudService';

const router = Router();

router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const totalAgents = agentCrudService.countAllAgents();
    const enabledAgents = agentCrudService.countEnabledAgents();
    const presetAgents = agentCrudService.countPresetAgents();
    const totalExecutions = agentCrudService.countAllExecutions();
    const categoryStats = agentCrudService.countAgentsByCategory();

    res.json({
      success: true,
      data: {
        totalAgents,
        enabledAgents,
        presetAgents,
        totalExecutions,
        categoryStats,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch agent stats:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to fetch agent stats',
    });
  }
});

// ── 推荐测试输入（前端 AgentTestPanel"填充推荐输入"按钮调用）──
const PRESET_TEST_INPUTS: Record<string, string> = {
  '告警处理 Agent': '服务器CPU使用率异常，当前值92%，阈值80%，请分析并提供处理建议',
  '告警处理': '服务器CPU使用率异常，当前值92%，阈值80%，请分析并提供处理建议',
  '故障诊断 Agent': '应用服务响应超时，请诊断可能的原因并提供排查步骤',
  '故障诊断': '应用服务响应超时，请诊断可能的原因并提供排查步骤',
  '日志分析 Agent': '系统日志中有多个错误记录，请分析并找出问题根源',
  '日志分析': '系统日志中有多个错误记录，请分析并找出问题根源',
  '系统巡检 Agent': '请执行系统健康检查，检查CPU、内存、磁盘、网络状态',
  '系统巡检': '请执行系统健康检查，检查CPU、内存、磁盘、网络状态',
  '变更执行 Agent': '请执行Nginx服务重启操作',
  '变更执行': '请执行Nginx服务重启操作',
  '文档生成 Agent': '请生成今天的系统运维报告',
  '文档生成': '请生成今天的系统运维报告',
  '合规检查 Agent': '请执行安全合规检查，验证系统配置是否符合安全标准',
  '合规检查': '请执行安全合规检查，验证系统配置是否符合安全标准',
  '服务器命令执行 Agent': '请检查服务器磁盘使用情况',
  '服务器命令执行': '请检查服务器磁盘使用情况',
  '自动巡检 Agent': '请对所有服务器执行批量巡检',
  '自动巡检': '请对所有服务器执行批量巡检',
  '数据库运维 Agent': '检查数据库健康状态',
  '数据库运维': '检查数据库健康状态',
};

// 注：2026-07-23 曾删除该路由（误判"前端无消费者"），前端 AgentTestPanel 仍在使用，
// 2026-08-09 恢复。
router.get('/:id/test-input', (req: Request, res: Response) => {
  try {
    const agent = agentCrudService.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent 不存在' });
    }
    const testInput = PRESET_TEST_INPUTS[agent.name] || '请描述您要处理的运维问题';
    res.json({ success: true, data: { testInput, agentName: agent.name } });
  } catch (error) {
    logger.error('Failed to get agent test input:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to get agent test input',
    });
  }
});

export default router;
