import { useState, useEffect } from 'react';
import { X, Download, FileText, Loader2 } from 'lucide-react';
import api from '../../../../lib/api';
import MarkdownOutput from '../../../../shared/components/MarkdownOutput';
import { useToast } from '../../../../contexts/ToastContext';

interface ComplianceReportModalProps {
  checkId: string;
  checkName: string;
  serverName: string;
  onClose: () => void;
}

/** 合规检查报告弹窗：后端生成的 Markdown 报告 + 下载 */
export default function ComplianceReportModal({
  checkId,
  checkName,
  serverName,
  onClose,
}: ComplianceReportModalProps) {
  const toast = useToast();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 加载报告
    api
      .get(`/servers/compliance-report/${checkId}`)
      .then(({ data }) => setMarkdown(data?.markdown ?? '# 报告生成失败'))
      .catch(() => {
        toast.error('加载报告失败');
        setMarkdown('# 报告加载失败，请稍后重试');
      })
      .finally(() => setLoading(false));
  }, [checkId]);

  const download = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `compliance-report-${checkName}-${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="p-4 border-b border-border flex items-center justify-between rounded-t-xl">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            合规检查报告
            <span className="text-sm font-normal text-text-secondary">{serverName} · {checkName}</span>
          </h3>
          <div className="flex items-center gap-2">
            {markdown && (
              <button
                onClick={download}
                className="px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> 下载
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-background rounded-lg transition-colors text-text-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 overflow-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm">报告生成中...</p>
            </div>
          ) : (
            <MarkdownOutput content={markdown || ''} className="text-sm" />
          )}
        </div>
      </div>
    </div>
  );
}
