/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * 虚拟机管理 - 华为 FusionSphere 适配器
 * =============================================================================
 * 通过 FusionSphere 的 OpenStack 兼容 API（Keystone v3 认证 + Nova 计算）
 * 管理虚拟机。连接信息：
 *   - host:      FusionSphere CPS/OpenStack 控制节点地址
 *   - port:      API 端口（默认 443）
 *   - projectName: 项目/租户名（默认 admin）
 *   - username / password
 *   - domainName:  认证域（默认 Default）
 *
 * 说明：FusionSphere 不同版本 OpenStack API 端点可能不同，本适配器实现
 * 通用 OpenStack 兼容调用（keystone v3 + nova v2.1）；如环境端点有差异，
 * 可在 buildEndpoint 中调整。
 */

import https from 'https';
import http from 'http';
import { BaseVMAdapter } from '../vmAdapter';
import type {
  VirtualMachine,
  VMStats,
  VMSnapshot,
  VMTemplate,
  HypervisorHost,
  Datastore,
  VirtualNetwork,
  ResourcePool,
  CreateVMRequest,
  CloneVMRequest,
  CreateSnapshotRequest,
  RestoreSnapshotRequest,
  MigrateVMRequest,
  ReconfigureVMRequest,
} from '../../../../../types/vmManagement';
import { logger } from '../../../../../utils/logger';

export interface FusionSphereConfig {
  host: string;
  port?: number;
  projectName?: string;
  username: string;
  password: string;
  domainName?: string;
  useHttp?: boolean;
}

interface VMItem {
  id: string;
  name: string;
  status: string;
  flavor?: { id?: string };
  addresses?: Record<string, Array<{ addr?: string }>>;
  metadata?: Record<string, string>;
  updated?: string;
  created?: string;
}

export class FusionSphereAdapter extends BaseVMAdapter {
  private baseUrl: string;
  private token: string | null = null;
  private projectId: string | null = null;

  constructor(platformId: string, config: FusionSphereConfig) {
    // 合并默认值存入基类 config（base 为 protected）
    super(platformId, { port: 443, projectName: 'admin', domainName: 'Default', ...config });
    const cfg = this.config as FusionSphereConfig;
    const proto = cfg.useHttp ? 'http' : 'https';
    this.baseUrl = `${proto}://${cfg.host}:${cfg.port}`;
  }

  // ── HTTP 工具 ──
  private async request(
    method: string,
    path: string,
    body?: any,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; headers: Record<string, any>; data: any }> {
    const url = `${this.baseUrl}${path}`;
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : undefined;
    const lib = parsed.protocol === 'http:' ? http : https;

    return new Promise((resolve, reject) => {
      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname + parsed.search,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
            ...headers,
          },
          // FusionSphere 自签名证书常见，跳过校验（与 proxmox 适配器一致）
          rejectUnauthorized: false,
          timeout: 30000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let data: any = null;
            try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
            resolve({ status: res.statusCode || 0, headers: res.headers, data });
          });
        },
      );
      req.on('timeout', () => req.destroy(new Error('请求超时')));
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  // ── 认证（Keystone v3）──
  async connect(): Promise<void> {
    const cfg = this.config as FusionSphereConfig;
    try {
      logger.info(`🔌 正在连接华为 FusionSphere: ${cfg.host}:${cfg.port}`);
      const res = await this.request('POST', '/v3/auth/tokens', {
        auth: {
          identity: {
            methods: ['password'],
            password: {
              user: {
                name: cfg.username,
                password: cfg.password,
                domain: { name: cfg.domainName },
              },
            },
          },
          scope: { project: { name: cfg.projectName, domain: { name: cfg.domainName } } },
        },
      });
      if (res.status >= 400 || !res.headers['x-subject-token']) {
        throw new Error(`FusionSphere 认证失败: HTTP ${res.status} ${res.data?.error?.message || ''}`.trim());
      }
      this.token = String(res.headers['x-subject-token']);
      // 从 token 响应中解析 project id（scope.project.id）
      this.projectId = res.data?.token?.project?.id || null;
      this.connected = true;
      logger.info(`✅ FusionSphere 连接成功 (${cfg.host})`);
    } catch (err) {
      this.connected = false;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.token = null;
    this.projectId = null;
    this.connected = false;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.listVMs();
      return true;
    } catch (err: any) {
      logger.warn(`FusionSphere 连接测试失败: ${err?.message || err}`);
      return false;
    } finally {
      await this.disconnect();
    }
  }

  // ── Nova 计算 API 封装 ──
  private async nova(path: string, method = 'GET', body?: any): Promise<any> {
    if (!this.token) await this.connect();
    const project = this.projectId || this.config.projectName;
    const res = await this.request(method, `/compute/v2.1/${project}${path}`, body, {
      'X-Auth-Token': this.token || '',
    });
    if (res.status >= 400) {
      throw new Error(`FusionSphere 计算 API 错误: HTTP ${res.status} ${res.data?.message || res.data?.error?.message || ''}`.trim());
    }
    return res.data;
  }

  private mapVM(v: VMItem): VirtualMachine {
    const networkInfo = v.addresses ? Object.values(v.addresses).flat() : [];
    const ips = networkInfo.map((n: any) => n?.addr).filter(Boolean);
    const status = v.status;
    return {
      id: v.id,
      name: v.name,
      hypervisorType: 'fusionsphere' as const,
      hypervisorId: v.id,
      // Nova 状态: ACTIVE/SHUTOFF/PAUSED/SUSPENDED/ERROR
      status: status === 'ACTIVE' ? 'running' : status === 'SHUTOFF' ? 'stopped' : status === 'PAUSED' ? 'paused' : status === 'SUSPENDED' ? 'suspended' : 'unknown',
      powerState: status === 'ACTIVE' ? 'poweredOn' : status === 'SHUTOFF' ? 'poweredOff' : status === 'SUSPENDED' ? 'suspended' : 'unknown',
      memoryMB: 0,
      numCPUs: 0,
      ipAddress: ips[0],
      createdAt: v.created || undefined,
      updatedAt: v.updated || undefined,
      disks: [],
      networkInterfaces: ips.map((ip, i) => ({
        id: `nic-${i}`,
        name: `eth${i}`,
        ipAddress: [ip],
        connected: true,
      })),
    } as VirtualMachine;
  }

  async listVMs(): Promise<VirtualMachine[]> {
    const data = await this.nova('/servers/detail');
    const servers: VMItem[] = data?.servers || [];
    return servers.map((s) => this.mapVM(s));
  }

  async getVM(vmId: string): Promise<VirtualMachine | null> {
    const data = await this.nova(`/servers/${vmId}`);
    return data?.server ? this.mapVM(data.server) : null;
  }

  async createVM(request: CreateVMRequest): Promise<VirtualMachine> {
    const data = await this.nova('/servers', 'POST', {
      server: {
        name: request.config.name,
        flavorRef: request.templateId || '',
        imageRef: request.templateId || '',
        networks: request.config.networkInterfaces?.length
          ? request.config.networkInterfaces.map((n) => ({ uuid: n.id }))
          : undefined,
      },
    });
    const server: VMItem = data?.server;
    return this.mapVM(server);
  }

  async deleteVM(vmId: string): Promise<void> {
    await this.nova(`/servers/${vmId}`, 'DELETE');
  }

  async powerOnVM(vmId: string): Promise<void> {
    await this.nova(`/servers/${vmId}/action`, 'POST', { 'os-start': null });
  }

  async powerOffVM(vmId: string): Promise<void> {
    await this.nova(`/servers/${vmId}/action`, 'POST', { 'os-stop': null });
  }

  async restartVM(vmId: string): Promise<void> {
    await this.nova(`/servers/${vmId}/action`, 'POST', { reboot: { type: 'SOFT' } });
  }

  async suspendVM(vmId: string): Promise<void> {
    await this.nova(`/servers/${vmId}/action`, 'POST', { 'os-suspend': null });
  }

  async pauseVM(vmId: string): Promise<void> {
    await this.nova(`/servers/${vmId}/action`, 'POST', { pause: null });
  }

  async resumeVM(vmId: string): Promise<void> {
    await this.nova(`/servers/${vmId}/action`, 'POST', { 'os-resume': null });
  }

  // ── 暂未实现的操作（FusionSphere 控制台可完成）──
  async listSnapshots(_vmId: string): Promise<VMSnapshot[]> {
    throw new Error('FusionSphere 适配器暂不支持快照列表，请在 FusionSphere 控制台操作');
  }
  async createSnapshot(_request: CreateSnapshotRequest): Promise<VMSnapshot> {
    throw new Error('FusionSphere 适配器暂不支持创建快照');
  }
  async restoreSnapshot(_request: RestoreSnapshotRequest): Promise<void> {
    throw new Error('FusionSphere 适配器暂不支持恢复快照');
  }
  async deleteSnapshot(_snapshotId: string): Promise<void> {
    throw new Error('FusionSphere 适配器暂不支持删除快照');
  }
  async listTemplates(): Promise<VMTemplate[]> {
    throw new Error('FusionSphere 适配器暂不支持模板列表');
  }
  async createTemplate(_vmId: string, _name: string, _description?: string): Promise<VMTemplate> {
    throw new Error('FusionSphere 适配器暂不支持创建模板');
  }
  async deleteTemplate(_templateId: string): Promise<void> {
    throw new Error('FusionSphere 适配器暂不支持删除模板');
  }
  async getVMStats(_vmId: string): Promise<VMStats> {
    throw new Error('FusionSphere 适配器暂不支持实时统计');
  }
  async reconfigureVM(_request: ReconfigureVMRequest): Promise<VirtualMachine> {
    throw new Error('FusionSphere 适配器暂不支持调整配置');
  }
  async migrateVM(_request: MigrateVMRequest): Promise<void> {
    throw new Error('FusionSphere 适配器暂不支持迁移');
  }
  async cloneVM(_request: CloneVMRequest): Promise<VirtualMachine> {
    throw new Error('FusionSphere 适配器暂不支持克隆');
  }
  async listHosts(): Promise<HypervisorHost[]> {
    throw new Error('FusionSphere 适配器暂不支持宿主机列表');
  }
  async getHost(_hostId: string): Promise<HypervisorHost> {
    throw new Error('FusionSphere 适配器暂不支持宿主机详情');
  }
  async listDatastores(): Promise<Datastore[]> {
    throw new Error('FusionSphere 适配器暂不支持存储列表');
  }
  async getDatastore(_datastoreId: string): Promise<Datastore> {
    throw new Error('FusionSphere 适配器暂不支持存储详情');
  }
  async listNetworks(): Promise<VirtualNetwork[]> {
    throw new Error('FusionSphere 适配器暂不支持网络列表');
  }
  async listResourcePools(): Promise<ResourcePool[]> {
    throw new Error('FusionSphere 适配器暂不支持资源池列表');
  }
}
