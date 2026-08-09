/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { validateBody, validateParams } from '../../../middleware/validation';
import { serverSchemas } from '../../../shared/schemas/apiValidation';
import { requireRole } from '../../../middleware/auth';
import { serverCrudService } from '../services/serverCrudService';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const servers = serverCrudService.listServers();
    res.json({ success: true, data: servers });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get servers' });
  }
});

router.get('/:id', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const server = serverCrudService.getServerById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    res.json({ success: true, data: server });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get server' });
  }
});

router.post('/', validateBody(serverSchemas.createServer), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const result = serverCrudService.createServer(req.body as any);
    res.json(result);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create server' });
  }
});

router.put('/:id', validateParams(serverSchemas.serverId), validateBody(serverSchemas.updateServer), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const result = serverCrudService.updateServer(req.params.id, req.body as any);
    if (!result.success) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update server' });
  }
});

router.delete('/:id', validateParams(serverSchemas.serverId), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    serverCrudService.deleteServer(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete server' });
  }
});

router.get('/:id/command-history', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const history = serverCrudService.listCommandHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get command history' });
  }
});

router.get('/:id/compliance-history', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const checks = serverCrudService.listComplianceChecks(req.params.id);
    res.json({ success: true, data: checks });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get compliance history' });
  }
});

router.get('/:id/command-history/export', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const result = serverCrudService.exportCommandHistory(req.params.id);
    if (!result.success) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="command-history-${req.params.id}-${Date.now()}.json"`);
    res.json(result.data);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export command history' });
  }
});

router.get('/:id/compliance-history/export', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const result = serverCrudService.exportComplianceHistory(req.params.id);
    if (!result.success) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-history-${req.params.id}-${Date.now()}.json"`);
    res.json(result.data);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export compliance history' });
  }
});

// ═══════════════════════════════════════════════════════
// 合规检查 Markdown 报告（人类可读）
// ═══════════════════════════════════════════════════════

/** 兼容解析日期：旧格式 "YYYY-MM-DD HH:MM:SS"（无时区，按 UTC 补 Z） */
function fmtDate(s?: string | null): string {
  if (!s) return '-';
  const normalized = s.includes(' ') ? s.replace(' ', 'T') + 'Z' : s;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('zh-CN');
}

/** 将 check_results（Record<string, CommandResult>）渲染为人类可读 Markdown 报告 */
function buildComplianceReportMarkdown(
  check: { check_name: string; status: string; started_at?: string; completed_at?: string },
  serverName: string,
  results: Record<string, any>,
): string {
  const lines: string[] = [];
  lines.push(`# 合规检查报告`);
  lines.push('');
  lines.push('| 项目 | 值 |');
  lines.push('| --- | --- |');
  lines.push(`| 服务器 | ${serverName} |`);
  lines.push(`| 检查名称 | ${check.check_name} |`);
  lines.push(`| 状态 | ${check.status === 'completed' ? '✅ 已完成' : check.status} |`);
  lines.push(`| 开始时间 | ${fmtDate(check.started_at)} |`);
  lines.push(`| 完成时间 | ${fmtDate(check.completed_at)} |`);
  lines.push('');

  const entries = Object.entries(results);
  const passed = entries.filter(([, r]) => r && r.success === true).length;
  const total = entries.length;
  const passRate = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;

  lines.push(`## 总览`);
  lines.push('');
  lines.push(`- **检查项总数**: ${total}`);
  lines.push(`- **通过**: ${passed}`);
  lines.push(`- **失败**: ${total - passed}`);
  lines.push(`- **通过率**: ${passRate}%`);
  lines.push('');

  lines.push(`## 检查项详情`);
  lines.push('');

  entries.forEach(([name, r], idx) => {
    const ok = r && r.success === true;
    const icon = ok ? '✅' : '❌';
    lines.push(`### ${idx + 1}. ${icon} ${name} — ${ok ? '通过' : '失败'}`);
    lines.push('');
    if (r && r.command) {
      lines.push('**执行命令**:');
      lines.push('');
      lines.push('```bash');
      lines.push(r.command);
      lines.push('```');
      lines.push('');
    }
    if (r && r.stdout) {
      lines.push('**输出**:');
      lines.push('');
      lines.push('```');
      lines.push(String(r.stdout).slice(0, 2000));
      lines.push('```');
      lines.push('');
    }
    if (r && r.stderr) {
      lines.push('**错误输出**:');
      lines.push('');
      lines.push('```');
      lines.push(String(r.stderr).slice(0, 2000));
      lines.push('```');
      lines.push('');
    }
    if (r && r.error) {
      lines.push(`**错误**: ${r.error}`);
      lines.push('');
    }
    if (r && r.aiAnalysis) {
      lines.push('**AI 分析建议**:');
      lines.push('');
      lines.push(`> ${String(r.aiAnalysis).replace(/\n/g, '\n> ')}`);
      lines.push('');
    }
  });

  lines.push('---');
  lines.push(`*报告生成时间: ${new Date().toLocaleString('zh-CN')}*`);
  return lines.join('\n');
}

// GET 单次合规检查的人类可读 Markdown 报告
router.get('/compliance-report/:checkId', (req: Request, res: Response) => {
  try {
    const check = serverCrudService.getComplianceCheck(req.params.checkId);
    if (!check) {
      return res.status(404).json({ success: false, error: '合规检查记录不存在' });
    }
    const server = serverCrudService.getServerById(check.server_id);
    let results: Record<string, any> = {};
    try {
      results = JSON.parse(check.check_results || '{}');
    } catch {
      results = {};
    }
    const markdown = buildComplianceReportMarkdown(
      { check_name: check.check_name, status: check.status, started_at: check.started_at ?? undefined, completed_at: check.completed_at ?? undefined },
      server?.name || check.server_id,
      results,
    );
    res.json({ success: true, data: { markdown, check_id: check.id, server_id: check.server_id } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to build compliance report' });
  }
});

export default router;
