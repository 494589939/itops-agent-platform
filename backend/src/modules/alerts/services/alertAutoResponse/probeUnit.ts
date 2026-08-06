/**
 * =============================================================================
 * AARS v2 — 探针单元编目系统
 *
 * 设计思路：
 *   不是硬编码"告警类型→命令"映射表，而是声明式探针编目，
 *   每个探针携带适用范围、风险等级、信息增益权重。
 *   由 strategyRecommender 动态组合推荐。
 * =============================================================================
 */

import type { ProbeUnit } from './types';

/**
 * 全量探针编目
 * 按类别分组，每个探针有唯一 id
 */
export const PROBE_CATALOG: ProbeUnit[] = [

  // ════════════════════════ 通用探针 ════════════════════════

  {
    id: 'os_version',
    name: '操作系统版本',
    description: '获取 OS 发行版、内核版本',
    applicableOS: ['linux', 'windows', 'network_os'],
    risk: 'readonly',
    commands: ['uname -a && cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || hostnamectl 2>/dev/null'],
    oids: ['1.3.6.1.2.1.1.1.0'], // sysDescr
    infoGainWeight: 0.2,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'uptime_load',
    name: '运行时长和负载',
    description: '系统运行时间和 CPU 负载',
    applicableOS: ['linux', 'network_os'],
    risk: 'readonly',
    commands: ['uptime && cat /proc/loadavg'],
    infoGainWeight: 0.4,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'cpu_hogs',
    name: 'CPU 高消耗进程',
    description: '按 CPU 使用率排序的 Top 进程',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['ps aux --sort=-%cpu | head -20'],
    infoGainWeight: 0.8,
    timeoutMs: 10000,
    enabled: true,
  },

  {
    id: 'mem_hogs',
    name: '内存高消耗进程',
    description: '按内存使用率排序的 Top 进程',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['ps aux --sort=-%mem | head -20'],
    infoGainWeight: 0.8,
    timeoutMs: 10000,
    enabled: true,
  },

  {
    id: 'disk_usage',
    name: '磁盘使用率',
    description: '各分区磁盘使用情况',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['df -h | grep -v tmpfs | grep -v overlay | grep -v devtmpfs'],
    infoGainWeight: 0.7,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'disk_hogs',
    name: '大文件/目录',
    description: '磁盘空间最大消耗者',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['du -sh /* 2>/dev/null | sort -rh | head -15'],
    infoGainWeight: 0.6,
    timeoutMs: 15000,
    enabled: true,
  },

  {
    id: 'memory_detail',
    name: '内存详请',
    description: '详细内存使用情况（含 swap/cache）',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['free -m && cat /proc/meminfo'],
    infoGainWeight: 0.5,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'io_stats',
    name: '磁盘 I/O 统计',
    description: '磁盘读写延迟和 IOPS（需 sysstat）',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['iostat -x 1 3 2>/dev/null || echo "iostat not available"'],
    infoGainWeight: 0.5,
    timeoutMs: 8000,
    enabled: true,
  },

  {
    id: 'network_connections',
    name: '网络连接状态',
    description: '所有监听和活跃连接',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo "no ss/netstat"'],
    infoGainWeight: 0.6,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'dmesg_errors',
    name: '内核错误日志',
    description: '最近内核错误和告警消息',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['dmesg -T --level=err,warn 2>/dev/null | tail -50 || dmesg | tail -50'],
    infoGainWeight: 0.7,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'journal_errors',
    name: '系统日志错误',
    description: '最近系统日志中的错误',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['journalctl -p err -n 50 --no-pager 2>/dev/null || tail -50 /var/log/syslog 2>/dev/null || echo "no journal"'],
    infoGainWeight: 0.7,
    timeoutMs: 8000,
    enabled: true,
  },

  {
    id: 'process_tree',
    name: '进程树',
    description: '完整进程树',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['pstree -ap 2>/dev/null | head -50 || ps -ef --forest | head -50'],
    infoGainWeight: 0.3,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'failed_services',
    name: '失败服务列表',
    description: 'systemd 失败状态的服务',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['systemctl list-units --failed --no-pager 2>/dev/null || echo "no systemctl"'],
    infoGainWeight: 0.8,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'zombie_processes',
    name: '僵尸进程',
    description: '检查僵尸进程数量',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['ps aux | awk \'{if ($8=="Z") print}\' | head -20'],
    infoGainWeight: 0.4,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'network_bandwidth',
    name: '网络带宽使用',
    description: '实时网络带宽（需 iftop/nload）或 /proc/net/dev',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['cat /proc/net/dev | tail -n +3 | head -10'],
    infoGainWeight: 0.5,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'arp_table',
    name: 'ARP 表',
    description: '邻居发现表',
    applicableOS: ['linux', 'network_os'],
    risk: 'readonly',
    commands: ['ip neigh 2>/dev/null || arp -a 2>/dev/null | head -20'],
    oids: ['1.3.6.1.2.1.4.22.1.2'],
    infoGainWeight: 0.3,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'listening_ports',
    name: '监听端口安全',
    description: '所有监听端口，检查是否有多余开放端口',
    applicableOS: ['linux', 'network_os'],
    risk: 'readonly',
    commands: ['ss -tlnp 2>/dev/null | awk \'NR>1{print $4,$6}\' | head -30 || netstat -tlnp 2>/dev/null | head -30'],
    infoGainWeight: 0.4,
    timeoutMs: 5000,
    enabled: true,
  },

  // ════════════════════════ 网络设备 SNMP 探针 ════════════════════════

  {
    id: 'snmp_if_errors',
    name: '接口错误统计',
    description: '各接口入/出错误和丢弃包计数',
    applicableOS: ['network_os'],
    risk: 'readonly',
    oids: [
      '1.3.6.1.2.1.2.2.1.14',  // ifInErrors
      '1.3.6.1.2.1.2.2.1.20',  // ifOutErrors
      '1.3.6.1.2.1.2.2.1.13',  // ifInDiscards
      '1.3.6.1.2.1.2.2.1.19',  // ifOutDiscards
    ],
    infoGainWeight: 0.7,
    timeoutMs: 8000,
    enabled: true,
  },

  {
    id: 'snmp_cpu_usage',
    name: 'CPU 使用率（SNMP）',
    description: '网络设备 CPU 利用率',
    applicableOS: ['network_os'],
    risk: 'readonly',
    oids: ['1.3.6.1.4.1.9.9.109.1.1.1.1.7'],  // CISCO-CPU
    infoGainWeight: 0.8,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'snmp_mem_usage',
    name: '内存使用率（SNMP）',
    description: '网络设备内存利用率',
    applicableOS: ['network_os'],
    risk: 'readonly',
    oids: ['1.3.6.1.4.1.9.9.48.1.1.1.5'],  // CISCO-MEMORY
    infoGainWeight: 0.7,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'snmp_temperature',
    name: '设备温度（SNMP）',
    description: '设备温度和风扇状态',
    applicableOS: ['network_os'],
    risk: 'readonly',
    oids: ['1.3.6.1.4.1.9.9.13.1.3.1.3'],  // CISCO-ENVMON
    infoGainWeight: 0.6,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'snmp_interface_status',
    name: '接口状态',
    description: '各接口管理状态和运行状态',
    applicableOS: ['network_os'],
    risk: 'readonly',
    oids: [
      '1.3.6.1.2.1.2.2.1.7',  // ifAdminStatus
      '1.3.6.1.2.1.2.2.1.8',  // ifOperStatus
    ],
    infoGainWeight: 0.9,
    timeoutMs: 8000,
    enabled: true,
  },

  {
    id: 'snmp_interface_traffic',
    name: '接口流量',
    description: '各接口入/出流量速率',
    applicableOS: ['network_os'],
    risk: 'readonly',
    oids: [
      '1.3.6.1.2.1.2.2.1.10',  // ifInOctets
      '1.3.6.1.2.1.2.2.1.16',  // ifOutOctets
    ],
    infoGainWeight: 0.6,
    timeoutMs: 8000,
    enabled: true,
  },

  {
    id: 'snmp_system_uptime',
    name: '设备运行时间（SNMP）',
    description: '网络设备启动时长',
    applicableOS: ['network_os'],
    risk: 'readonly',
    oids: ['1.3.6.1.2.1.1.3.0'],  // sysUpTime
    infoGainWeight: 0.2,
    timeoutMs: 5000,
    enabled: true,
  },

  // ════════════════════════ 专项诊断探针 ════════════════════════

  {
    id: 'app_log_tail',
    name: '应用日志尾部',
    description: '特定应用日志最后 50 行（需传参）',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['tail -50 {{log_path}} 2>/dev/null || echo "log not found"'],
    infoGainWeight: 0.5,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'process_detail',
    name: '进程详情',
    description: '指定进程的详细信息（fd/open files）',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['ls -la /proc/{{pid}}/fd 2>/dev/null | head -30 && cat /proc/{{pid}}/status 2>/dev/null'],
    infoGainWeight: 0.6,
    timeoutMs: 5000,
    enabled: true,
  },

  {
    id: 'docker_ps',
    name: '容器列表',
    description: 'Docker 容器运行状态',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['docker ps -a 2>/dev/null | head -30 || echo "docker not available"'],
    infoGainWeight: 0.4,
    timeoutMs: 8000,
    enabled: true,
  },

  {
    id: 'selinux_apparmor',
    name: 'SELinux/AppArmor 状态',
    description: '强制访问控制状态',
    applicableOS: ['linux'],
    risk: 'readonly',
    commands: ['getenforce 2>/dev/null; sestatus 2>/dev/null | head -5; aa-status 2>/dev/null | head -10; echo "---"'],
    infoGainWeight: 0.3,
    timeoutMs: 5000,
    enabled: true,
  },
];

// ── 探针索引 ──

export const PROBE_INDEX = new Map<string, ProbeUnit>();
for (const probe of PROBE_CATALOG) {
  PROBE_INDEX.set(probe.id, probe);
}

// ── 按类别分组 ──

export interface ProbeGroup {
  id: string;
  name: string;
  probes: ProbeUnit[];
}

export const PROBE_GROUPS: ProbeGroup[] = [
  {
    id: 'general',
    name: '通用基础探针',
    probes: PROBE_CATALOG.filter(p => p.applicableOS.includes('linux') && p.risk === 'readonly'),
  },
  {
    id: 'snmp_network',
    name: 'SNMP 网络设备探针',
    probes: PROBE_CATALOG.filter(p => p.applicableOS.includes('network_os')),
  },
  {
    id: 'specialized',
    name: '专项诊断探针',
    probes: PROBE_CATALOG.filter(p => p.applicableOS.includes('linux') && (p.id.startsWith('app_') || p.id.startsWith('process_') || p.id.startsWith('docker_') || p.id.startsWith('selinux_'))),
  },
];

/**
 * 根据告警内容关键词匹配最相关探针
 * 基于 TF-IDF 风格的简单关键词匹配
 */
export function findProbesByAlertText(alertTitle: string, alertContent: string): ProbeUnit[] {
  const text = `${alertTitle} ${alertContent}`.toLowerCase();
  const keywords = text.split(/[\s\-_,.:/]+/).filter(k => k.length > 2);
  const scored = PROBE_CATALOG.filter(p => p.enabled).map(probe => {
    let score = 0;
    const desc = probe.description.toLowerCase();
    const name = probe.name.toLowerCase();
    for (const kw of keywords) {
      if (desc.includes(kw) || name.includes(kw)) score += 1;
    }
    // 探针自身上下文中的关键词
    for (const cmd of probe.commands || []) {
      if (cmd.toLowerCase().includes('cpu') && text.includes('cpu')) score += 2;
      if (cmd.toLowerCase().includes('mem') && (text.includes('memory') || text.includes('mem'))) score += 2;
      if (cmd.toLowerCase().includes('disk') && (text.includes('disk') || text.includes('storage'))) score += 2;
      if (cmd.toLowerCase().includes('network') && text.includes('network')) score += 2;
      if (cmd.toLowerCase().includes('service') && (text.includes('service') || text.includes('process'))) score += 2;
      if (cmd.toLowerCase().includes('docker') && text.includes('docker')) score += 2;
    }
    return { probe, score: score + probe.infoGainWeight * 5 };
  });

  return scored
    .filter(s => s.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(s => s.probe);
}

export function getProbeById(id: string): ProbeUnit | undefined {
  return PROBE_INDEX.get(id);
}
