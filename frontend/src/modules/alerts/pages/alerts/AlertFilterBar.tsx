import { Search } from 'lucide-react';

interface AlertFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  severityFilter: string;
  onSeverityChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  // 设备类型（source）
  sourceFilter: string;
  onSourceChange: (value: string) => void;
  sources: string[];
  // 时间区间
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
}

export default function AlertFilterBar({
  searchQuery,
  onSearchChange,
  severityFilter,
  onSeverityChange,
  statusFilter,
  onStatusChange,
  sourceFilter,
  onSourceChange,
  sources,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: AlertFilterBarProps) {
  return (
    <div className="p-6 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">告警列表</h2>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索告警..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => onSeverityChange(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="all">所有级别</option>
          <option value="critical">严重</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="all">所有状态</option>
          <option value="new">新</option>
          <option value="acknowledged">已确认</option>
          <option value="resolved">已解决</option>
        </select>
        {/* 设备类型（source）筛选 */}
        <select
          value={sourceFilter}
          onChange={(e) => onSourceChange(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="all">所有设备类型</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {/* 时间区间（默认当天） */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
          />
          <span className="text-text-secondary text-sm">至</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
      </div>
    </div>
  );
}