/**
 * ICMP/Ping 发现工具
 * 从 networkDiscoveryService.ts 提取的 Ping 扫描与 IP 计算工具
 *
 * 2026-08-08 修复：
 *   - 新增 TCP 端口探测兜底（ping 失败/无权限时，用 TCP connect 判断设备是否在线）
 *     原因：Docker 容器内非 root 用户（gosu appuser, UID 1001）运行 ping
 *     缺少 CAP_NET_RAW 权限会直接失败；且很多企业网络防火墙屏蔽 ICMP。
 *     TCP connect 不需要特殊权限，能更可靠地发现在线设备。
 */

import * as net from 'net';

const isWindows = process.platform === 'win32';

/**
 * 跨平台 Ping 命令构建（Windows 和 Linux 语法不同）
 */
export function buildPingCommand(ip: string): string {
  if (isWindows) {
    return `ping -n 1 -w 2000 ${ip}`;
  }
  return `ping -c 1 -W 2 ${ip}`;
}

/**
 * 跨平台 Ping 输出检测（中英文兼容）
 */
export function isPingSuccess(stdout: string): boolean {
  // 通用检测：TTL 值（英文/中文输出都包含）
  if (/ttl=/i.test(stdout)) return true;
  // Linux 英文输出
  if (stdout.includes('1 received') || stdout.includes('1 packets received')) return true;
  // Windows 中文输出
  if (stdout.includes('TTL=')) return true;
  // 通用：收到 = 1
  if (stdout.includes('已接收 = 1') || stdout.includes('Received = 1')) return true;
  return false;
}

/**
 * TCP 端口探测：尝试连接指定端口，任一开放即认为设备在线
 *
 * 不需要 CAP_NET_RAW 权限，普通用户即可运行。
 * 用于 ping 失败时的兜底探测（容器内非 root、防火墙屏蔽 ICMP 等场景）。
 *
 * 2026-08-08 修复（收紧端口，降低误报）：
 *   - 默认端口从 [22, 80, 443, 161, 8291] 收紧为设备管理端口 [22, 161, 8291]
 *   - 原因：80/443 是 HTTP 端口，网关/透明代理/强制门户会对「任意 IP」响应，
 *     导致大量离线主机被误判为在线；而扫描目的是发现网络设备，
 *     应只探测设备管理端口（SSH / SNMP / Winbox）。
 *
 * @param ip 目标 IP
 * @param ports 待探测端口列表，默认设备管理端口
 * @param timeoutMs 单端口超时（毫秒），默认 1500ms
 * @returns 开放的端口号（0 = 全部不通）
 */
export function probeTcpPort(ip: string, ports: number[] = [22, 161, 8291], timeoutMs = 1500): Promise<number> {
  return new Promise(resolve => {
    let resolved = false;
    let pendingCount = ports.length;

    const finish = (port: number) => {
      if (resolved) return;
      resolved = true;
      resolve(port);
    };

    for (const port of ports) {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
        pendingCount--;
        if (pendingCount === 0 && !resolved) finish(0);
      };

      socket.on('connect', () => {
        if (resolved) { socket.destroy(); return; }
        socket.destroy();
        finish(port);
      });
      socket.on('timeout', cleanup);
      socket.on('error', cleanup);

      try {
        socket.connect(port, ip);
      } catch {
        cleanup();
      }
    }

    // 整体超时兜底
    setTimeout(() => finish(0), timeoutMs + 200);
  });
}

/**
 * 综合 host 在线检测：先 ping，ping 失败再用 TCP 端口兜底
 *
 * @returns { online: boolean, method: 'icmp' | 'tcp' | 'none', port?: number }
 */
export async function isHostOnline(ip: string): Promise<{ online: boolean; method: string; port?: number }> {
  // 方式 1：ICMP ping（需要权限，容器内可能失败）
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { stdout } = await execAsync(buildPingCommand(ip), { timeout: 3000 });
    if (isPingSuccess(stdout)) {
      return { online: true, method: 'icmp' };
    }
  } catch {
    // ping 失败（权限不足 / 防火墙屏蔽 ICMP / 主机不在线）— 继续尝试 TCP 兜底
  }

  // 方式 2：TCP 端口探测兜底（无需特殊权限）
  const openPort = await probeTcpPort(ip);
  if (openPort > 0) {
    return { online: true, method: 'tcp', port: openPort };
  }

  return { online: false, method: 'none' };
}

/**
 * 计算 IP 范围大小
 */
export function calculateIpRange(startIp: string, endIp: string): number {
  const start = ipToInt(startIp);
  const end = ipToInt(endIp);
  return Math.max(0, end - start + 1);
}

/**
 * 生成 IP 列表
 */
export function generateIpList(startIp: string, endIp: string): string[] {
  const start = ipToInt(startIp);
  const end = ipToInt(endIp);
  const ips: string[] = [];
  for (let i = start; i <= end; i++) {
    ips.push(intToIp(i));
  }
  return ips;
}

export function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function intToIp(int: number): string {
  return [(int >>> 24), (int >>> 16) & 0xFF, (int >>> 8) & 0xFF, int & 0xFF].join('.');
}