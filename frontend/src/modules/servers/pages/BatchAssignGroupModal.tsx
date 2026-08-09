import { useState } from 'react';
import { FolderPlus, X, CheckCircle2, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';

interface GroupOption {
  id: string;
  name: string;
  parent_id?: string | null;
}

interface BatchAssignGroupModalProps {
  open: boolean;
  serverIds: string[];
  serverCount: number;
  groupsData: GroupOption[] | undefined;
  onClose: () => void;
  onFinished: () => void;
}

export default function BatchAssignGroupModal({
  open,
  serverIds,
  serverCount,
  groupsData,
  onClose,
  onFinished,
}: BatchAssignGroupModalProps) {
  const toast = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  // 展示分组（排除根分组"全部服务器"）
  const groups = (groupsData || []).filter((g) => g.parent_id !== null);

  const handleSubmit = async () => {
    if (!selectedGroupId) { toast.error('请选择分组'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/server-groups/mapping', {
        server_ids: serverIds,
        group_id: selectedGroupId,
      });
      toast.success(`已将 ${data?.added ?? serverIds.length} 台服务器加入分组`);
      setSelectedGroupId('');
      onFinished();
      onClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || '加入分组失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl w-full max-w-md border border-border shadow-2xl flex flex-col">
        <div className="p-5 border-b border-border/30 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-blue-500" />
            加入分组
            <span className="text-sm font-normal text-text-secondary bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full">
              已选 {serverCount} 台
            </span>
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-xl text-text-secondary hover:text-text-primary transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">选择分组</label>
            {groups.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-sm transition-colors',
                      selectedGroupId === g.id
                        ? 'bg-blue-600 text-white border border-blue-600'
                        : 'bg-background border border-border text-text-secondary hover:border-blue-500/50 hover:text-text-primary',
                    )}
                  >
                    {selectedGroupId === g.id ? '✓ ' : ''}{g.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">暂无分组，请先创建分组</p>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-border/30 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-surface border border-border rounded-xl text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedGroupId}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-all font-medium flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitting ? '加入中...' : '确认加入'}
          </button>
        </div>
      </div>
    </div>
  );
}
