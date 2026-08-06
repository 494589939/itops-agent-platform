/**
 * =============================================================================
 * Docker 端点管理（多主机 Docker 连接配置）路由
 * =============================================================================
 * 从 containerRoutes.ts 拆分而出，以缓解后者超过 max-lines(500) 限制。
 * 通过 containerRoutes 顶部的 `router.use('/', dockerEndpointRoutes)` 挂载，
 * 故本文件路由的最终路径仍为 /api/v1/containers/status、/api/v1/containers/endpoints 等，
 * 与拆分前完全一致。子路由器仅处理自身已声明路径，其余请求 next() 透传，
 * 不会拦截 containerRoutes 的 /:id 等容器路由。
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { dockerService } from '../services/dockerService';
import { multiHostDockerService } from '../services/multiHostDockerService';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { logger } from '../../../utils/logger';
import { dockerEndpointCrudService } from '../services/dockerEndpointCrudService';

const router = Router();

/**
 * GET /status — 聚合 Docker 可用性检查
 * 返回：
 *   {
 *     local: { available: boolean, error?: string },
 *     endpoints: [{ id, name, status, lastConnected }],
 *     hasUsableDocker: boolean  // 至少一个端点可连通 OR 本地 socket 可用
 *   }
 * 前端布局根据 hasUsableDocker 决定是否弹"未配置 Docker 端点"提示
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    // 本地
    const localAvailable = dockerService.isAvailable();
    const local: { available: boolean; error?: string } = { available: localAvailable };
    if (!localAvailable) local.error = '本地 Docker socket 不可用';

    // 多主机端点
    const endpoints = multiHostDockerService.listEndpoints();
    const usableEndpoints = endpoints.filter((e: { status: string }) => e.status === 'active');

    const hasUsableDocker = localAvailable || usableEndpoints.length > 0;

    res.json({
      success: true,
      data: {
        local,
        endpoints: endpoints.map(
          (e: { id: string; name: string; status: string; last_connected?: string }) => ({
            id: e.id,
            name: e.name,
            status: e.status,
            lastConnected: e.last_connected,
          }),
        ),
        hasUsableDocker,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /endpoints — 列出所有 Docker 端点
router.get('/endpoints', requireRole('admin', 'operator'), (_req: Request, res: Response) => {
  try {
    const endpoints = multiHostDockerService.listEndpoints();
    // 始终包含本地
    const localAvailable = dockerService.isAvailable();
    const all = [
      {
        id: 'local',
        name: '本地 Docker',
        host: 'localhost',
        port: 0,
        protocol: 'socket',
        status: localAvailable ? ('active' as const) : ('inactive' as const),
      },
      ...endpoints,
    ];
    res.json({ success: true, data: all });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /endpoints — 添加远程 Docker 端点
router.post('/endpoints', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { name, host, port, protocol, tlsCa, tlsCert, tlsKey } = req.body;
    if (!name || !host) {
      return res.status(400).json({ success: false, message: '名称和主机为必填项' });
    }
    const endpoint = await multiHostDockerService.addEndpoint({
      name,
      host,
      port: port || 2375,
      protocol: protocol || 'tcp',
      tlsCa: tlsCa || undefined,
      tlsCert: tlsCert || undefined,
      tlsKey: tlsKey || undefined,
      status: 'inactive',
    });
    // 异步测试连接
    multiHostDockerService
      .testConnection({
        host,
        port: port || 2375,
        protocol: protocol || 'tcp',
        tls_ca: tlsCa,
        tls_cert: tlsCert,
        tls_key: tlsKey,
      })
      .then((result) => {
        const status = result.success ? 'active' : 'error';
        dockerEndpointCrudService.updateStatusAndError(endpoint.id, status, result.message || null);
      })
      .catch((err) => {
        // 之前只记日志、不更新状态 → 端点永远卡在 inactive；现改为标记 error
        logger.warn('Docker endpoint connection test failed:', err);
        dockerEndpointCrudService.updateStatusAndError(endpoint.id, 'error', getErrorMessage(err));
      });
    res.json({ success: true, data: endpoint });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// PUT /endpoints/:id — 更新端点
router.put(
  '/endpoints/:id',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      const endpoint = await multiHostDockerService.updateEndpoint(req.params.id, req.body);
      res.json({ success: true, data: endpoint });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

// DELETE /endpoints/:id — 删除端点
router.delete(
  '/endpoints/:id',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      await multiHostDockerService.deleteEndpoint(req.params.id);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

// POST /endpoints/test — 测试连接
router.post(
  '/endpoints/test',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      const result = await multiHostDockerService.testConnection(req.body);
      res.json({ success: true, data: result });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

// POST /endpoints/:id/refresh — 刷新端点信息
router.post(
  '/endpoints/:id/refresh',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      await multiHostDockerService.refreshEndpointInfo(req.params.id);
      const endpoint = multiHostDockerService.getEndpoint(req.params.id);
      res.json({ success: true, data: endpoint });
    } catch (err: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(err) });
    }
  },
);

export default router;
