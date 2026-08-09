import { useState, useEffect } from 'react';
import { ShieldCheck, Save, Info, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';

interface AccessControlData {
  allowed_ips: string[];
  current_ip?: string;
}

export default function AccessControlPage() {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [currentIp, setCurrentIp] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/settings/access-control')
      .then(({ data }) => {
        const d = data as AccessControlData;
        setValue((d.allowed_ips || []).join('\n'));
        setCurrentIp(d.current_ip || '');
      })
      .catch(() => toast.error('加载访问控制配置失败'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const rules = value
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const { data } = await api.put('/settings/access-control', { allowed_ips: rules });
      if (data?.success !== false) {
        toast.success(rules.length === 0 ? '已恢复为允许所有地址访问' : '访问控制已更新');
      } else {
        toast.error(data?.error || '保存失败');
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || '保存失败，请检查输入格式');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 标题 */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            平台访问控制
          </h1>
          <p className="text-text-secondary text-sm">
            限制可以访问本平台的来源 IP 或网段，降低网络攻击风险。
          </p>
        </div>

        {/* 当前状态提示 */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary space-y-1">
              <p>
                当前来源 IP：<span className="font-mono text-text-primary">{currentIp || '未知'}</span>
              </p>
              <p>
                {value.trim()
                  ? '已启用白名单：仅下列地址可访问平台（含当前 IP 若不在列表中，保存后将立即失去访问权限）。'
                  : '当前状态：允许所有地址访问（默认）。配置白名单后仅允许列表内地址访问。'}
              </p>
            </div>
          </div>
        </div>

        {/* 配置表单 */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            允许访问的 IP / 网段（每行一个）
          </label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={'192.168.1.0/24\n10.0.0.5\n172.16.0.0/16'}
            rows={8}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-blue-500 placeholder:text-text-tertiary"
            disabled={loading}
          />
          <p className="text-xs text-text-tertiary mt-2 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            支持格式：精确 IP（如 192.168.1.5）或 CIDR 网段（如 192.168.1.0/24）；清空并保存 = 允许所有地址。
          </p>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || loading}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存配置
            </button>
          </div>
        </div>

        {/* 安全提示 */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary space-y-1">
              <p className="font-medium text-amber-500">⚠️ 配置前请务必包含你当前的访问 IP</p>
              <p>
                当前 IP 为 <span className="font-mono">{currentIp || '未知'}</span>。
                保存后，不在列表内的来源 IP 将立即无法访问平台（包括登录页）。
                如误配导致无法访问，请通过服务器控制台连接容器后执行：
              </p>
              <pre className="bg-background p-3 rounded text-xs font-mono text-text-primary overflow-x-auto">
                docker exec itops-backend node -e "require('./dist/repositories/settingsRepository.js').settingsRepository.delete('ACCESS_CONTROL_ALLOWED_IPS')"
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
