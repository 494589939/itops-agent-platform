import { useState } from 'react';
import { ShieldCheck, FileText, Download } from 'lucide-react';
import clsx from 'clsx';
import { logger } from '@/lib/logger';
import api from '../../../../lib/api';
import type { Server as ServerType, ComplianceCheck, CommandResult } from '../types';
import ComplianceReportModal from './ComplianceReportModal';

interface ComplianceHistorySectionProps {
  selectedServer: ServerType;
  complianceHistory: ComplianceCheck[] | undefined;
}

/** 解析 check_results JSON 字符串，失败返回空对象 */
function parseCheckResults(check: ComplianceCheck): Record<string, CommandResult> {
  if (!check.check_results) return {};
  try {
    const parsed = JSON.parse(check.check_results);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** 兼容解析日期：旧格式 "YYYY-MM-DD HH:MM:SS"（无时区，按 UTC 补 Z） */
function fmtTime(s?: string): string {
  if (!s) return '-';
  const normalized = s.includes(' ') ? s.replace(' ', 'T') + 'Z' : s;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

export function ComplianceHistorySection({
  selectedServer,
  complianceHistory,
}: ComplianceHistorySectionProps) {
  const [reportCheckId, setReportCheckId] = useState<string | null>(null);
  const reportCheck = complianceHistory?.find((c) => c.id === reportCheckId) || null;

  const exportHistory = async () => {
    try {
      // 注意：baseURL 已是 /api/v1，这里不要再加 /api 前缀
      const response = await api.get(
        `/servers/${selectedServer.id}/compliance-history/export`,
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `compliance-history-${selectedServer.id}-${Date.now()}.json`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('导出失败:', error);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-text-primary">
          合规检查历史 - {selectedServer.name}
        </h2>
        <button
          onClick={exportHistory}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Download className="w-4 h-4" />
          导出历史
        </button>
      </div>

      <div className="space-y-4">
        {complianceHistory?.map((check) => {
          const results = parseCheckResults(check);
          const entries = Object.entries(results);
          const passedCount = entries.filter(([, r]) => r && r.success === true).length;
          const isCompleted = check.status === 'completed';

          return (
            <div key={check.id} className="bg-background rounded-lg p-4">
              {/* 头部：检查名 + 状态 */}
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-text-primary">{check.check_name}</h4>
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'px-2 py-1 rounded text-xs font-medium',
                      isCompleted
                        ? 'bg-status-success/10 text-status-success'
                        : check.status === 'running'
                          ? 'bg-status-running/10 text-status-running'
                          : 'bg-status-failed/10 text-status-failed',
                    )}
                  >
                    {isCompleted ? '已完成' : check.status === 'running' ? '执行中' : '失败'}
                  </span>
                  {isCompleted && (
                    <button
                      onClick={() => setReportCheckId(check.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors text-xs font-medium"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      查看报告
                    </button>
                  )}
                </div>
              </div>

              {/* 时间 + 概要 */}
              <div className="text-xs text-text-secondary space-y-1">
                <p>开始: {fmtTime(check.started_at)}</p>
                <p>完成: {fmtTime(check.completed_at)}</p>
                {isCompleted && entries.length > 0 && (
                  <p>
                    结果: <span className="text-status-success">{passedCount} 通过</span>
                    {' / '}
                    <span className="text-status-failed">{entries.length - passedCount} 失败</span>
                    {' / 共 '}
                    {entries.length} 项
                  </p>
                )}
              </div>

              {/* 结构化结果（仅 completed 且有结果时） */}
              {isCompleted && entries.length > 0 && (
                <div className="mt-4 space-y-3">
                  {entries.map(([checkName, result]) => (
                    <div key={checkName} className="bg-surface rounded-lg p-3 border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="text-sm font-medium text-text-primary">
                          {checkName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h5>
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            result.success
                              ? 'bg-status-success/10 text-status-success'
                              : 'bg-status-failed/10 text-status-failed',
                          )}
                        >
                          {result.success ? '成功' : '失败'}
                        </span>
                      </div>

                      {result.aiAnalysis && (
                        <div className="mb-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">🤖</span>
                            <span className="text-sm font-medium text-primary">AI 分析建议</span>
                          </div>
                          <p className="text-xs text-text-secondary whitespace-pre-wrap">{result.aiAnalysis}</p>
                        </div>
                      )}

                      <details className="mt-1">
                        <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                          查看原始命令和输出
                        </summary>
                        <div className="mt-2">
                          {result.command && (
                            <div className="text-xs text-text-secondary mb-1">
                              命令: <code className="font-mono bg-background px-1 rounded">{result.command}</code>
                            </div>
                          )}
                          {result.stdout && (
                            <div className="mt-2">
                              <p className="text-xs text-text-secondary mb-1">输出:</p>
                              <pre className="bg-background p-3 rounded text-xs overflow-x-auto text-text-primary font-mono max-h-40 overflow-y-auto">
                                {result.stdout}
                              </pre>
                            </div>
                          )}
                          {result.stderr && (
                            <div className="mt-2">
                              <p className="text-xs text-status-warning mb-1">错误:</p>
                              <pre className="bg-status-failed/5 p-3 rounded text-xs overflow-x-auto text-status-failed font-mono max-h-40 overflow-y-auto">
                                {result.stderr}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}

              {/* 无解析结果（running/失败/空） */}
              {!isCompleted && (
                <div className="mt-3">
                  <details>
                    <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                      查看原始结果
                    </summary>
                    <pre className="mt-2 bg-surface p-3 rounded text-xs overflow-x-auto text-text-primary font-mono max-h-60 overflow-y-auto">
                      {check.check_results || '(无)'}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          );
        })}

        {(!complianceHistory || complianceHistory.length === 0) && (
          <div className="text-center py-12 text-text-secondary">
            <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无合规检查历史</p>
          </div>
        )}
      </div>

      {/* 报告弹窗 */}
      {reportCheck && (
        <ComplianceReportModal
          checkId={reportCheck.id}
          checkName={reportCheck.check_name}
          serverName={selectedServer.name}
          onClose={() => setReportCheckId(null)}
        />
      )}
    </div>
  );
}
