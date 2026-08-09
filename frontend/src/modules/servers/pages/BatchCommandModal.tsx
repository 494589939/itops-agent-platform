import { useState, useEffect, useRef } from 'react';
import { Terminal, X, Copy, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import type { Server as ServerType } from './types';

interface BatchResultItem {
  serverId: string;
  name: string;
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  error: string;
}

interface BatchCommandModalProps {
  open: boolean;
  servers: ServerType[]; // 选中的目标服务器
  onClose: () => void;
  onFinished: () => void; // 执行完成后回调（可刷新等）
}

export default function BatchCommandModal({ open, servers, onClose, onFinished }: BatchCommandModalProps) {
  const toast = useToast();
  const [command, setCommand] = useState('');
  const [concurrency, setConcurrency] = useState(5);
  const [timeoutSec, setTimeoutSec] = useState(30);
  const [running, setRunning] = useState(false);
  const [taskState, setTaskState] = useState<{
    taskId: string;
    total: number;
    completed: number;
    successCount: number;
    failedCount: number;
    status: string;
  } | null>(null);
  const [results, setResults] = useState<BatchResultItem[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // 待人工确认任务（AI 等外部发起的批量任务，需人工批准后执行）
  const [pendingTasks, setPendingTasks] = useState<Array<{ taskId: string; command: string; total: number; requestedBy: string; createdAt: number }>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPendingTasks = async () => {
    try {
      const { data } = await api.get('/server-commands/batch/pending');
      setPendingTasks(data || []);
    } catch { /* 静默 */ }
  };

  // 打开时重置 + 加载待确认任务
  useEffect(() => {
    if (open) {
      setRunning(false);
      setTaskState(null);
      setResults(null);
      setExpanded(new Set());
      loadPendingTasks();
    }
  }, [open]);

  const pollStatus = (taskId: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/server-commands/batch/status/${taskId}`);
        setTaskState({ taskId, total: data.total, completed: data.completed, successCount: data.successCount, failedCount: data.failedCount, status: data.status });
        if (data.status === 'done') {
          if (timerRef.current) clearInterval(timerRef.current);
          setResults(data.results || []);
          setRunning(false);
          onFinished();
        } else if (data.status === 'error') {
          if (timerRef.current) clearInterval(timerRef.current);
          setRunning(false);
          toast.error(data.error || '批量执行失败');
        }
      } catch {
        if (timerRef.current) clearInterval(timerRef.current);
        setRunning(false);
        toast.error('查询执行进度失败');
      }
    }, 1200);
  };

  const handleRun = async () => {
    if (!command.trim()) { toast.error('请输入命令或脚本'); return; }
    if (servers.length === 0) { toast.error('请选择目标服务器'); return; }
    setRunning(true);
    setResults(null);
    setTaskState({ taskId: '', total: servers.length, completed: 0, successCount: 0, failedCount: 0, status: 'running' });
    try {
      const { data } = await api.post('/server-commands/batch', {
        serverIds: servers.map((s) => s.id),
        command,
        concurrency,
        timeout: timeoutSec * 1000,
        requireConfirmation: false, // 用户手动操作：已主动确认，无需二次审批
      });
      pollStatus(data.taskId);
    } catch (err) {
      setRunning(false);
      setTaskState(null);
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || '批量执行发起失败');
    }
  };

  const copyAll = () => {
    if (!results) return;
    const text = results
      .map((r) => `[${r.success ? 'OK' : 'FAIL'}] ${r.name} (${r.durationMs}ms)\n${r.success ? r.stdout : (r.error || r.stderr)}`)
      .join('\n\n');
    navigator.clipboard?.writeText(text).then(() => toast.success('结果已复制到剪贴板')).catch(() => toast.error('复制失败'));
  };

  const approvePending = async (taskId: string) => {
    try {
      await api.post(`/server-commands/batch/${taskId}/approve`);
      toast.success('已批准执行');
      loadPendingTasks();
    } catch { toast.error('批准失败'); }
  };

  const rejectPending = async (taskId: string) => {
    try {
      await api.post(`/server-commands/batch/${taskId}/reject`);
      toast.success('已取消该任务');
      loadPendingTasks();
    } catch { toast.error('取消失败'); }
  };

  if (!open) return null;

  const percent = taskState && taskState.total > 0 ? Math.round((taskState.completed / taskState.total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl w-full max-w-4xl border border-border shadow-2xl flex flex-col max-h-[92vh]">
        {/* 头部 */}
        <div className="p-5 border-b border-border/30 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-500" />
            批量执行命令
            <span className="text-sm font-normal text-text-secondary bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full">
              已选 {servers.length} 台
            </span>
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-xl text-text-secondary hover:text-text-primary transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* 目标服务器 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">目标服务器</label>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto scrollbar-thin">
              {servers.map((s) => (
                <span key={s.id} className="text-xs px-2 py-1 bg-surface border border-border rounded-lg text-text-secondary">
                  {s.name} <span className="text-text-tertiary">{s.hostname}</span>
                </span>
              ))}
            </div>
          </div>

          {/* 命令/脚本 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              命令 / 脚本 <span className="text-red-400">*</span>
              <span className="text-xs text-text-tertiary ml-2">支持多行脚本，逐台在服务器上执行</span>
            </label>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={running}
              placeholder={'例如：\n# 查看磁盘使用\n df -h\n\n# 或一段脚本\nfor i in $(seq 1 5); do echo "loop $i"; done'}
              className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary font-mono text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all h-40 resize-none disabled:opacity-50"
            />
          </div>

          {/* 并发 / 超时 */}
          <div className="flex gap-6">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">并发数</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={concurrency}
                  disabled={running}
                  onChange={(e) => setConcurrency(Math.max(1, Math.min(20, Number(e.target.value) || 5)))}
                  className="w-24 px-3 py-2 bg-surface border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                />
                <span className="text-xs text-text-tertiary">1-20，越大越快但负载越高</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">单台超时（秒）</label>
              <input
                type="number"
                min={5}
                max={300}
                value={timeoutSec}
                disabled={running}
                onChange={(e) => setTimeoutSec(Math.max(5, Math.min(300, Number(e.target.value) || 30)))}
                className="w-24 px-3 py-2 bg-surface border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
              />
            </div>
          </div>

          {/* 待人工确认任务（AI/外部发起） */}
          {pendingTasks.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">
                待人工确认的任务
                <span className="text-xs text-text-tertiary ml-2">AI 或其他入口发起的批量任务，需批准后才会执行</span>
              </label>
              {pendingTasks.map((t) => (
                <div key={t.taskId} className="flex items-center gap-3 border border-yellow-500/30 bg-yellow-500/5 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate font-mono">{t.command.slice(0, 60)}</div>
                    <div className="text-xs text-text-tertiary">
                      {t.taskId.slice(0, 18)}… · {t.total} 台 · 发起人 {t.requestedBy} · {new Date(t.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => approvePending(t.taskId)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-white transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> 批准执行
                  </button>
                  <button
                    onClick={() => rejectPending(t.taskId)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-surface border border-border rounded-lg text-text-secondary hover:text-red-400 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> 取消
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 执行中：进度条 */}
          {running && taskState && (
            <div className="space-y-2 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在批量执行...
                </span>
                <span className="text-text-secondary">{taskState.completed}/{taskState.total} 台</span>
              </div>
              <div className="w-full h-2.5 bg-background rounded-full overflow-hidden border border-border">
                <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${Math.max(2, percent)}%` }} />
              </div>
              <div className="flex gap-4 text-xs text-text-secondary">
                <span className="text-green-400">成功 {taskState.successCount}</span>
                <span className="text-red-400">失败 {taskState.failedCount}</span>
              </div>
            </div>
          )}

          {/* 结果 */}
          {results && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-text-primary">执行结果</span>
                  <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />成功 {results.filter((r) => r.success).length}</span>
                  <span className="text-red-400 flex items-center gap-1"><XCircle className="w-4 h-4" />失败 {results.filter((r) => !r.success).length}</span>
                </div>
                <button onClick={copyAll} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-surface border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">
                  <Copy className="w-3.5 h-3.5" /> 复制全部
                </button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                {results.map((r) => {
                  const isExpanded = expanded.has(r.serverId);
                  return (
                    <div key={r.serverId} className={clsx('border rounded-xl overflow-hidden', r.success ? 'border-green-500/30' : 'border-red-500/40')}>
                      <button
                        onClick={() => setExpanded((prev) => { const next = new Set(prev); if (next.has(r.serverId)) next.delete(r.serverId); else next.add(r.serverId); return next; })}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-surface hover:bg-background transition-colors"
                      >
                        {r.success ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        <span className="text-sm font-medium text-text-primary truncate flex-1">{r.name}</span>
                        {!r.success && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full', r.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>
                          {r.success ? `${r.durationMs}ms` : '失败'}
                        </span>
                      </button>
                      {isExpanded && (
                        <pre className="px-4 py-3 bg-black/40 text-xs text-text-secondary whitespace-pre-wrap break-all max-h-48 overflow-y-auto border-t border-border/30 font-mono">
                          {r.success ? r.stdout || '(无输出)' : (r.error || r.stderr || '(无错误信息)')}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-5 border-t border-border/30 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={running}
            className="px-5 py-2.5 bg-surface border border-border rounded-xl text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            关闭
          </button>
          <button
            onClick={handleRun}
            disabled={running || !command.trim() || servers.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-all shadow-lg shadow-blue-500/20 font-medium flex items-center gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
            {running ? '执行中...' : '执行'}
          </button>
        </div>
      </div>
    </div>
  );
}
