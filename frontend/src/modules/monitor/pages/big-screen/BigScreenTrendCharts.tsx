/**
 * BigScreenDashboard - 资源趋势图表组（2026-07-21 拆分）
 *
 * 从原 BigScreenDashboard.tsx L644-676 抽出
 * 4 个 AnimatedLineChart：CPU / 内存 / 网络流量 / 磁盘 I/O
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { Cpu, MemoryStick, Network, HardDrive } from 'lucide-react';
import AnimatedLineChart from '../../components/AnimatedLineChart';
import type { DataPoint } from './types';

export interface BigScreenTrendChartsProps {
  cpuData: DataPoint[];
  memoryData: DataPoint[];
  networkData: DataPoint[];
  diskIOData: DataPoint[];
  /** 无真实采集数据时前端在用随机模拟数据，为 true 时显示“模拟数据”角标 */
  isMockData?: boolean;
}

export default function BigScreenTrendCharts({
  cpuData,
  memoryData,
  networkData,
  diskIOData,
  isMockData = false,
}: BigScreenTrendChartsProps) {
  const MockBadge = () =>
    isMockData ? (
      <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 ml-2">
        模拟数据
      </span>
    ) : null;

  return (
    <>
      {/* CPU + 内存趋势 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            CPU趋势
            <MockBadge />
          </h3>
          <AnimatedLineChart data={cpuData} color="#3b82f6" height={120} />
        </div>
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <MemoryStick className="w-4 h-4 text-purple-400" />
            内存趋势
            <MockBadge />
          </h3>
          <AnimatedLineChart data={memoryData} color="#8b5cf6" height={120} />
        </div>
      </div>

      {/* 网络 + 磁盘趋势 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <Network className="w-4 h-4 text-cyan-400" />
            网络流量 (Mbps)
            <MockBadge />
          </h3>
          <AnimatedLineChart data={networkData} color="#06b6d4" height={120} />
        </div>
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-yellow-400" />
            磁盘I/O (MB/s)
            <MockBadge />
          </h3>
          <AnimatedLineChart data={diskIOData} color="#f59e0b" height={120} />
        </div>
      </div>
    </>
  );
}
