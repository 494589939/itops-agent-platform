/**
 * =============================================================================
 * 平台访问控制中间件（IP / 网段白名单）
 * =============================================================================
 * - 配置存 settings 表 key: ACCESS_CONTROL_ALLOWED_IPS（JSON 字符串数组）
 *   ["192.168.1.0/24", "10.0.0.5", "172.16.0.0/16"]
 * - 未配置（空数组 / 无 key）→ 允许所有地址访问（默认行为）
 * - 命中任一规则（精确 IP 或 CIDR 网段）→ 放行；否则 403
 * - /health* 放行（容器/编排健康检查不依赖业务白名单）
 * - 客户端 IP 解析：优先 X-Forwarded-For 第一个（nginx 反代），
 *   否则取 socket remoteAddress（剥 ::ffff: 前缀）
 */

import type { Request, Response, NextFunction } from 'express';
import { settingsRepository } from '../repositories';
import { logger } from '../utils/logger';

export const ACCESS_CONTROL_SETTING_KEY = 'ACCESS_CONTROL_ALLOWED_IPS';

/** IPv4 字符串转 32 位整数 */
function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc * 256 + (parseInt(part, 10) || 0)) >>> 0, 0);
}

/** 是否合法 IPv4 */
export function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  return (
    parts.length === 4 &&
    parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255)
  );
}

/** 单个 IP 是否匹配规则（精确 IP 或 CIDR 网段） */
export function ipInRange(ip: string, rule: string): boolean {
  const trimmed = (rule || '').trim();
  if (!trimmed || !isValidIPv4(ip)) return false;

  const slashIdx = trimmed.indexOf('/');
  if (slashIdx >= 0) {
    const base = trimmed.slice(0, slashIdx).trim();
    const prefixStr = trimmed.slice(slashIdx + 1).trim();
    if (!isValidIPv4(base)) return false;
    const prefix = parseInt(prefixStr, 10);
    if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;

    const ipInt = ipv4ToInt(ip);
    const baseInt = ipv4ToInt(base);
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (baseInt & mask);
  }

  return ip === trimmed;
}

/** 解析客户端真实 IP（兼容 nginx 反代 X-Forwarded-For） */
export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0].trim();
    if (isValidIPv4(first)) return first;
  }
  return (req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

/** 读取当前允许列表（数组） */
export function getAllowedIps(): string[] {
  try {
    const raw = settingsRepository.getValue(ACCESS_CONTROL_SETTING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

export function accessControlMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 健康检查放行（容器/编排健康检查不依赖业务白名单，避免误判宕机）
  if (req.path === '/health' || req.path.startsWith('/health/')) {
    next();
    return;
  }

  try {
    const allowed = getAllowedIps();
    if (allowed.length === 0) {
      // 未配置任何规则 = 默认允许所有
      next();
      return;
    }

    const clientIp = getClientIp(req);
    if (allowed.some((rule) => ipInRange(clientIp, rule))) {
      next();
      return;
    }

    logger.warn(`[AccessControl] 拒绝访问: 客户端 IP ${clientIp} 不在允许列表 (${allowed.join(', ')})`);
    res.status(403).json({ success: false, message: '当前来源 IP 不在平台允许访问列表内' });
  } catch (err) {
    // 校验失败放行，避免配置异常导致平台完全锁死
    logger.error('[AccessControl] 校验异常，已放行:', err);
    next();
  }
}
