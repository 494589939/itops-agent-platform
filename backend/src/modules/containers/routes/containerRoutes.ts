import type { Request, Response } from 'express';
import { Router } from 'express';
import { dockerService } from '../services/dockerService';
import { multiHostDockerService } from '../services/multiHostDockerService';
import { requireRole } from '../../../middleware/auth';
import Docker from 'dockerode';
import { getErrorMessage, getErrorStatusCode } from '../../../utils/errorHelpers';
import { logger } from '../../../utils/logger';
import dockerEndpointRoutes from './dockerEndpointRoutes';
import { normalizeContainer, collectContainerLogs } from '../services/docker/containerOps';
import type { DockerContainer } from '../services/docker/dockerService';

const router = Router();

// ── Docker 客户端获取（支持多主机） ──
function getDocker(req: Request): Docker {
  const endpointId = req.query.endpointId as string | undefined;
  if (endpointId) {
    try {
      return multiHostDockerService.getDockerClient(endpointId);
    } catch {
      throw Object.assign(new Error('指定的 Docker 端点不可用'), { statusCode: 503 });
    }
  }
  // 默认使用本地 socket
  return new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
}

function checkDockerAvailable(res: Response, req?: Request): boolean {
  if (req) {
    const endpointId = req.query.endpointId as string | undefined;
    if (endpointId) {
      if (!multiHostDockerService.getEndpoint(endpointId)) {
        res.status(404).json({ success: false, message: 'Docker 端点不存在' });
        return false;
      }
      return true;
    }
  }
  if (!dockerService.isAvailable()) {
    // 尝试自动初始化一次
    dockerService.init().catch((err) => {
      logger.warn('Docker init failed:', err);
    });
    res.status(503).json({ success: false, message: 'Docker 服务不可用，请先配置 Docker 连接' });
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════
// 端点管理（多主机 Docker 连接配置）
// 已拆分到 dockerEndpointRoutes.ts；此处按原序挂载以保持 API 路径不变
// （必须在 /:id 等容器路由之前挂载，避免 /status 等单段路径被容器详情路由捕获）
// ═══════════════════════════════════════════════════
router.use('/', dockerEndpointRoutes);

// ═══════════════════════════════════════════════════
// 容器管理
// ═══════════════════════════════════════════════════

// GET / — 容器列表
router.get('/', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = ((req.query.search as string) || '').toLowerCase();
    const status = ((req.query.status as string) || '').toLowerCase();
    const endpointId = req.query.endpointId as string | undefined;

    // 本地与远程统一归一化为 camelCase（DockerContainer），避免前端按端点拿到不同大小写字段
    let allContainers: DockerContainer[];
    if (endpointId && endpointId !== 'local') {
      const d = getDocker(req);
      allContainers = (await d.listContainers({ all: true })).map(normalizeContainer);
    } else {
      allContainers = await dockerService.listContainers(true);
    }

    let filtered = allContainers;
    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.image.toLowerCase().includes(search),
      );
    }
    if (status) {
      filtered = filtered.filter((c) => c.state.toLowerCase() === status);
    }
    const total = filtered.length;
    const data = filtered.slice((page - 1) * pageSize, page * pageSize);
    // 2026-07-23 把 total 嵌入 data.items（避免被前端 axios 拦截器剥掉兄弟字段）
    res.json({ success: true, data: { items: data, total } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /hosts — 返回所有可用端点
router.get('/hosts', (_req: Request, res: Response) => {
  try {
    const endpoints = multiHostDockerService.listEndpoints();
    const localAvailable = dockerService.isAvailable();
    const all = [
      {
        id: 'local',
        name: '本地 Docker',
        host: 'localhost',
        status: localAvailable ? 'active' : 'inactive',
      },
      ...endpoints.map((e) => ({ id: e.id, name: e.name, host: e.host, status: e.status })),
    ];
    res.json({ success: true, data: all });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /logs/:id — 容器日志
router.get('/logs/:id', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const tail = parseInt(req.query.tail as string) || 100;
    const timestamps = req.query.timestamps !== 'false';
    const d = getDocker(req);
    // dockerode 的 container.logs() 返回多路复用流，直接 .toString('utf-8') 会得到
    // '[object Object]'；改用 collectContainerLogs 经 demuxStream 拼接为字符串
    const logs = await collectContainerLogs(d, req.params.id, { tail, timestamps });
    res.json({ success: true, data: logs });
  } catch (err: unknown) {
    res
      .status(getErrorStatusCode(err) || 500)
      .json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /stats/:id — 容器实时统计
router.get('/stats/:id', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const d = getDocker(req);
    const container = d.getContainer(req.params.id);
    const stats = await container.stats({ stream: false });
    res.json({ success: true, data: stats });
  } catch (err: unknown) {
    res
      .status(getErrorStatusCode(err) || 500)
      .json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /run — 创建并运行容器
router.post('/run', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const d = getDocker(req);
    const { image, name, ports, env, volumes, restartPolicy, memory, cpuShares } = req.body;
    if (!image) return res.status(400).json({ success: false, message: '缺少镜像名称' });

    const config: Record<string, unknown> = { Image: image, name: name || undefined };
    const hostConfig: Record<string, unknown> = {};

    if (ports && Array.isArray(ports)) {
      const ep: Record<string, unknown> = {};
      const pb: Record<string, unknown> = {};
      for (const m of ports) {
        const [hp, cp] = String(m).split(':');
        if (cp) {
          ep[`${cp}/tcp`] = {};
          pb[`${cp}/tcp`] = [{ HostPort: hp }];
        }
      }
      if (Object.keys(ep).length) {
        config.ExposedPorts = ep;
        hostConfig.PortBindings = pb;
      }
    }
    if (volumes && Array.isArray(volumes)) hostConfig.Binds = volumes.map(String);
    if (env && Array.isArray(env)) config.Env = env.map(String);
    if (restartPolicy) hostConfig.RestartPolicy = { Name: restartPolicy };
    if (memory) hostConfig.Memory = memory;
    if (cpuShares) hostConfig.CpuShares = cpuShares;
    if (Object.keys(hostConfig).length) config.HostConfig = hostConfig;

    const container = await d.createContainer(config);
    await container.start();
    res.json({ success: true, data: { id: container.id, name: name || container.id } });
  } catch (err: unknown) {
    res
      .status(getErrorStatusCode(err) || 500)
      .json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /:id — 容器详情
router.get('/:id', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const d = getDocker(req);
    const container = d.getContainer(req.params.id);
    const data = await container.inspect();
    res.json({ success: true, data });
  } catch (err: unknown) {
    res
      .status(getErrorStatusCode(err) || 404)
      .json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /:id/start
router.post('/:id/start', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const d = getDocker(req);
    await d.getContainer(req.params.id).start();
    res.json({ success: true, message: '容器已启动' });
  } catch (err: unknown) {
    res
      .status(getErrorStatusCode(err) || 500)
      .json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /:id/stop
router.post('/:id/stop', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const d = getDocker(req);
    await d.getContainer(req.params.id).stop();
    res.json({ success: true, message: '容器已停止' });
  } catch (err: unknown) {
    res
      .status(getErrorStatusCode(err) || 500)
      .json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /:id/restart
router.post(
  '/:id/restart',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    if (!checkDockerAvailable(res, req)) return;
    try {
      const d = getDocker(req);
      await d.getContainer(req.params.id).restart();
      res.json({ success: true, message: '容器已重启' });
    } catch (err: unknown) {
      res
        .status(getErrorStatusCode(err) || 500)
        .json({ success: false, message: getErrorMessage(err) });
    }
  },
);

// DELETE /:id
router.delete('/:id', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const d = getDocker(req);
    // 之前硬编码 force:true 且丢弃 v 参数（与已弃用的 dockerRoutes 行为不一致）；
    // 现恢复 force/v 查询参数控制（v=true 联动删除匿名卷）
    const force = req.query.force === 'true';
    const v = req.query.v === 'true';
    await d.getContainer(req.params.id).remove({ force, v });
    res.json({ success: true });
  } catch (err: unknown) {
    res
      .status(getErrorStatusCode(err) || 500)
      .json({ success: false, message: getErrorMessage(err) });
  }
});

// ═══════════════════════════════════════════════════
// 镜像管理
// ═══════════════════════════════════════════════════

// ── 镜像拉取任务（内存态，供前端轮询进度）──
interface PullTask {
  taskId: string;
  imageName: string;
  status: 'running' | 'done' | 'error';
  percent: number;
  message: string;
  error?: string;
  updatedAt: number;
}
const pullTasks = new Map<string, PullTask>();
let pullTaskSeq = 0;

function formatPullBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function applyPullEvent(task: PullTask, evt: Record<string, unknown>): void {
  const status = typeof evt.status === 'string' ? evt.status : '';
  const pd = evt.progressDetail as { current?: number; total?: number } | undefined;
  if (pd && typeof pd.current === 'number') {
    if (typeof pd.total === 'number' && pd.total > 0) {
      task.percent = Math.max(task.percent, Math.min(99, Math.round((pd.current / pd.total) * 100)));
    }
    const cur = formatPullBytes(pd.current);
    const tot = typeof pd.total === 'number' && pd.total > 0 ? ' / ' + formatPullBytes(pd.total) : '';
    task.message = `${status} ${cur}${tot}`;
  } else if (status) {
    task.message = status.charAt(0).toUpperCase() + status.slice(1);
  }
  task.updatedAt = Date.now();
}

router.get('/images/list', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const d = getDocker(req);
    const images = await d.listImages();
    res.json({ success: true, data: images });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.post(
  '/images/pull',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    if (!checkDockerAvailable(res, req)) return;
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ success: false, message: '缺少镜像名称' });

      const taskId = `pull_${Date.now()}_${++pullTaskSeq}`;
      const task: PullTask = {
        taskId,
        imageName: image,
        status: 'running',
        percent: 0,
        message: '准备拉取...',
        updatedAt: Date.now(),
      };
      pullTasks.set(taskId, task);

      // 异步执行拉取：立即返回 taskId，前端通过 /images/pull/status/:taskId 轮询进度
      void (async () => {
        try {
          const d = getDocker(req);
          const stream = await d.pull(image);
          await new Promise<void>((resolve, reject) => {
            d.modem.followProgress(
              stream,
              (err: Error | null) => (err ? reject(err) : resolve()),
              (evt: Record<string, unknown>) => applyPullEvent(task, evt),
            );
          });
          task.status = 'done';
          task.percent = 100;
          task.message = '拉取完成';
          task.updatedAt = Date.now();
        } catch (err: unknown) {
          task.status = 'error';
          task.error = getErrorMessage(err);
          task.message = '拉取失败';
          task.updatedAt = Date.now();
        }
      })();

      res.json({ success: true, data: { taskId } });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

// 镜像拉取进度查询（前端轮询）
router.get('/images/pull/status/:taskId', (req: Request, res: Response) => {
  const task = pullTasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ success: false, message: '任务不存在或已过期' });
  res.json({ success: true, data: task });
});

router.delete(
  '/images/:id',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    if (!checkDockerAvailable(res, req)) return;
    try {
      const d = getDocker(req);
      const image = d.getImage(req.params.id);
      await image.remove({ force: true });
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════
// 数据卷管理
// ═══════════════════════════════════════════════════

router.get('/volumes/list', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const d = getDocker(req);
    const result = await d.listVolumes();
    res.json({ success: true, data: result.Volumes || [] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.post('/volumes', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const { name, driver, labels } = req.body;
    const d = getDocker(req);
    const vol = await d.createVolume({
      Name: name,
      Driver: driver || 'local',
      Labels: labels || {},
    });
    res.json({ success: true, data: vol });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.delete(
  '/volumes/:id',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    if (!checkDockerAvailable(res, req)) return;
    try {
      const d = getDocker(req);
      const vol = d.getVolume(req.params.id);
      await vol.remove({ force: true });
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════
// Docker 网络管理
// ═══════════════════════════════════════════════════

/** 将 Docker API 返回的 PascalCase 字段转为 camelCase，确保前端兼容 */
function normalizeNetwork(raw: Docker.NetworkInspectInfo): Record<string, unknown> {
  return {
    id: raw.Id || (raw as unknown as Record<string, unknown>).id,
    name: raw.Name || (raw as unknown as Record<string, unknown>).name,
    driver: raw.Driver || (raw as unknown as Record<string, unknown>).driver,
    scope: raw.Scope || (raw as unknown as Record<string, unknown>).scope,
    internal: raw.Internal ?? (raw as unknown as Record<string, unknown>).internal ?? false,
    attachable: raw.Attachable ?? (raw as unknown as Record<string, unknown>).attachable ?? false,
    ipam: raw.IPAM
      ? {
          driver: raw.IPAM.Driver || (raw.IPAM as unknown as Record<string, unknown>).driver,
          config: (
            ((raw.IPAM as unknown as Record<string, unknown>).Config ||
              (raw.IPAM as unknown as Record<string, unknown>).config ||
              []) as Array<Record<string, unknown>>
          ).map((c) => ({
            subnet: c.Subnet || c.subnet,
            gateway: c.Gateway || c.gateway,
          })),
        }
      : (raw as unknown as Record<string, unknown>).ipam || { driver: '', config: [] },
    containers: raw.Containers || (raw as unknown as Record<string, unknown>).containers || {},
    options: raw.Options || (raw as unknown as Record<string, unknown>).options || {},
    labels: raw.Labels || (raw as unknown as Record<string, unknown>).labels || {},
    created: raw.Created || (raw as unknown as Record<string, unknown>).created,
  };
}

router.get('/networks/list', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const d = getDocker(req);
    const networks = await d.listNetworks();
    res.json({ success: true, data: networks.map(normalizeNetwork) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.get('/networks/:id', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const d = getDocker(req);
    const net = d.getNetwork(req.params.id);
    const data = await net.inspect();
    res.json({ success: true, data: normalizeNetwork(data) });
  } catch (err: unknown) {
    res
      .status(getErrorStatusCode(err) || 404)
      .json({ success: false, message: getErrorMessage(err) });
  }
});

router.post('/networks', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res, req)) return;
  try {
    const { name, driver, subnet, gateway, internal, attachable } = req.body;
    const d = getDocker(req);
    const opts: Docker.NetworkCreateOptions = {
      Name: name,
      Driver: driver || 'bridge',
      Internal: !!internal,
      Attachable: !!attachable,
    };
    if (subnet) {
      opts.IPAM = { Config: [{ Subnet: subnet, Gateway: gateway || undefined }] };
    }
    const net = await d.createNetwork(opts);
    res.json({ success: true, data: net });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.delete(
  '/networks/:id',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    if (!checkDockerAvailable(res, req)) return;
    try {
      const d = getDocker(req);
      const net = d.getNetwork(req.params.id);
      await net.remove();
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

router.post(
  '/networks/:id/connect',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    if (!checkDockerAvailable(res, req)) return;
    try {
      const d = getDocker(req);
      const net = d.getNetwork(req.params.id);
      await net.connect({ Container: req.body.containerId });
      res.json({ success: true, message: '容器已连接到网络' });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

router.post(
  '/networks/:id/disconnect',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    if (!checkDockerAvailable(res, req)) return;
    try {
      const d = getDocker(req);
      const net = d.getNetwork(req.params.id);
      await net.disconnect({ Container: req.body.containerId });
      res.json({ success: true, message: '容器已断开网络' });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

export default router;
