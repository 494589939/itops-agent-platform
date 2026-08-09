import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image, RefreshCw, Download, Trash2, X } from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import type { ImageItem } from './types';
import { formatDate, imageRepo, imageTagOnly } from './types';

// 与 docker images 命令显示口径一致（1000 进制：326MB / 1.55GB）
function formatImageSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ── 镜像拉取任务状态（后端 GET /containers/images/pull/status/:taskId 返回）──
interface PullTaskStatus {
  taskId: string;
  imageName: string;
  status: 'running' | 'done' | 'error';
  percent: number;
  message: string;
  error?: string;
}

// ── Props ──────────────────────────────────────────────

interface ImageSectionProps {
  endpointId: string;
}

// ── Component ──────────────────────────────────────────

export function ImageSection({ endpointId }: ImageSectionProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showPullModal, setShowPullModal] = useState(false);
  const [pullImageName, setPullImageName] = useState('');
  const [pullTask, setPullTask] = useState<PullTaskStatus | null>(null);
  const pullTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imagesQueryKey = ['containers-images', endpointId];

  // 组件卸载时清理拉取进度轮询
  useEffect(() => {
    return () => {
      if (pullTimerRef.current) clearInterval(pullTimerRef.current);
    };
  }, []);

  const stopPullPolling = () => {
    if (pullTimerRef.current) {
      clearInterval(pullTimerRef.current);
      pullTimerRef.current = null;
    }
  };

  const pollPullStatus = (taskId: string) => {
    stopPullPolling();
    const params = endpointId !== 'local' ? { endpointId } : undefined;
    pullTimerRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/containers/images/pull/status/${taskId}`, { params });
        const t = data as PullTaskStatus;
        setPullTask({ ...t });
        if (t.status === 'done') {
          stopPullPolling();
          setPullTask(null);
          setShowPullModal(false);
          setPullImageName('');
          queryClient.invalidateQueries({ queryKey: imagesQueryKey });
          toast.success('镜像拉取成功');
        } else if (t.status === 'error') {
          stopPullPolling();
          setPullTask(null);
          toast.error(t.error || '拉取镜像失败');
        }
      } catch {
        stopPullPolling();
        setPullTask(null);
        toast.error('拉取镜像失败');
      }
    }, 1000);
  };

  // ═══ QUERIES ═══════════════════════════════════════════

  const { data: images = [], isLoading: imagesLoading, error: imagesError } = useQuery<ImageItem[]>({
    queryKey: imagesQueryKey,
    queryFn: async () => {
      const { data } = await api.get('/containers/images/list', {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      });
      return data || [];
    },
  });

  // ═══ MUTATIONS ═════════════════════════════════════════

  const pullImageMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/containers/images/pull', { image: pullImageName }, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      });
      return (data as { taskId?: string } | undefined)?.taskId;
    },
    onSuccess: (taskId) => {
      if (taskId) {
        // 异步拉取：启动进度轮询
        setPullTask({ taskId, imageName: pullImageName, status: 'running', percent: 0, message: '准备拉取...' });
        pollPullStatus(taskId);
      } else {
        // 兼容后端未返回 taskId 的情况：直接刷新列表
        queryClient.invalidateQueries({ queryKey: imagesQueryKey });
        toast.success('镜像拉取成功');
        setShowPullModal(false);
        setPullImageName('');
      }
    },
    onError: () => toast.error('拉取镜像失败'),
  });

  const deleteImageMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/containers/images/${id}`, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagesQueryKey });
      toast.success('镜像已删除');
    },
    onError: () => toast.error('删除镜像失败'),
  });

  // ═══ RENDER ═══════════════════════════════════════════

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: imagesQueryKey })}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> 刷新
        </button>
        <button
          onClick={() => setShowPullModal(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors"
        >
          <Download className="w-4 h-4" /> 拉取镜像
        </button>
      </div>

      {imagesError && (
        <div className="flex flex-col items-center justify-center py-20">
          <Image className="w-16 h-16 text-text-tertiary mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">镜像服务不可用</h3>
          <p className="text-text-secondary text-sm mb-4">Docker 引擎连接失败。</p>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: imagesQueryKey })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> 重试
          </button>
        </div>
      )}

      {!imagesError && (
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">仓库</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">标签</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">镜像ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden md:table-cell">大小</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden lg:table-cell">创建时间</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {imagesLoading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">加载中...</td></tr>
                ) : images.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">暂无镜像</td></tr>
                ) : (
                  images.map((img) => (
                    <tr key={img.Id || img.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm text-text-primary truncate max-w-[200px]">{imageRepo(img)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">{imageTagOnly(img)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-text-tertiary font-mono">{(img.Id || img.id || '').substring(0, 12)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                        <div className="text-sm text-text-secondary" title={`${img.Size ? img.Size.toLocaleString() + ' 字节' : ''}（与 docker images 命令一致，含共享层）`}>
                          {formatImageSize(img.Size || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-xs text-text-secondary">{formatDate(img.Created)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => { if (confirm('确定要删除此镜像吗？')) deleteImageMutation.mutate(img.Id || img.id || ''); }}
                          className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                          title="删除"
                        ><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pull Image Modal ── */}
      {showPullModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowPullModal(false); setPullImageName(''); }}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">拉取镜像</h3>
              <button onClick={() => { setShowPullModal(false); setPullImageName(''); }} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">镜像名称 <span className="text-red-400">*</span></label>
                <input type="text" value={pullImageName} onChange={(e) => setPullImageName(e.target.value)} placeholder="nginx:latest" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>

              {/* 拉取进度 */}
              {pullTask && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span className="truncate mr-2">{pullTask.message}</span>
                    <span className="shrink-0 font-medium">{pullTask.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${Math.max(2, pullTask.percent)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setShowPullModal(false); setPullImageName(''); stopPullPolling(); setPullTask(null); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-text-primary rounded-lg transition-colors text-sm" disabled={pullTask?.status === 'running'}>取消</button>
                <button onClick={() => pullImageMutation.mutate()} disabled={!pullImageName.trim() || pullImageMutation.isPending || pullTask?.status === 'running'}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {pullImageMutation.isPending || pullTask?.status === 'running' ? '拉取中...' : <><Download className="w-4 h-4" /> 拉取</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
