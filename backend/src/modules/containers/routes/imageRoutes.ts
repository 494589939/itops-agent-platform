/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { dockerService } from '../services/dockerService';
import { multiHostDockerService } from '../services/multiHostDockerService';
import { requireRole } from '../../../middleware/auth';
import Docker from 'dockerode';
import { getErrorMessage, getErrorStatusCode } from '../../../utils/errorHelpers';
import { normalizeImage } from '../services/docker/imageOps';
import { logger } from '../../../utils/logger';
import type { DockerImage } from '../services/docker/dockerService';

const router = Router();

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

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

function checkDockerAvailable(res: Response): boolean {
  if (!dockerService.isAvailable()) {
    res.status(503).json({ success: false, message: 'Docker 服务不可用' });
    return false;
  }
  return true;
}

function getDocker(req: Request): Docker {
  const endpointId = req.query.endpointId as string | undefined;
  if (endpointId) {
    try {
      return multiHostDockerService.getDockerClient(endpointId);
    } catch {
      throw Object.assign(new Error('指定的 Docker 端点不可用'), { statusCode: 503 });
    }
  }
  return docker;
}

// GET / — 获取镜像列表
router.get('/', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = (req.query.search as string || '').toLowerCase();
    const endpointId = req.query.endpointId as string | undefined;

    // 多主机：endpointId 指定时拉取目标主机镜像并归一化；否则走本地 dockerService
    let allImages: DockerImage[];
    if (endpointId && endpointId !== 'local') {
      const d = getDocker(req);
      allImages = (await d.listImages()).map(normalizeImage);
    } else {
      allImages = await dockerService.listImages();
    }

    let filtered = allImages;
    if (search) {
      filtered = filtered.filter(img =>
        img.repository.toLowerCase().includes(search) ||
        img.tag.toLowerCase().includes(search) ||
        (img.tags || []).some((t: string) => t.toLowerCase().includes(search))
      );
    }

    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const data = filtered.slice(offset, offset + pageSize);

    res.json({ success: true, data: { items: data, total } });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /pull — 拉取镜像
router.post('/pull', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const { imageName, endpointId } = req.body;
    if (!imageName) {
      return res.status(400).json({ success: false, message: '缺少镜像名称' });
    }

    const taskId = `pull_${Date.now()}_${++pullTaskSeq}`;
    const task: PullTask = {
      taskId,
      imageName,
      status: 'running',
      percent: 0,
      message: '准备拉取...',
      updatedAt: Date.now(),
    };
    pullTasks.set(taskId, task);

    // 异步执行拉取：立即返回 taskId，前端通过 /images/pull/status/:taskId 轮询进度
    void (async () => {
      try {
        if (endpointId) {
          const d = multiHostDockerService.getDockerClient(endpointId);
          await new Promise<void>((resolve, reject) => {
            d.pull(imageName, {}, (err: Error | null, stream?: NodeJS.ReadableStream) => {
              if (err) return reject(err);
              if (!stream) return reject(new Error('拉取未返回数据流'));
              d.modem.followProgress(
                stream,
                (err2: Error | null) => (err2 ? reject(err2) : resolve()),
                (evt: Record<string, unknown>) => applyPullEvent(task, evt),
              );
            });
          });
        } else {
          await dockerService.pullImage(imageName, (evt: Record<string, unknown>) => applyPullEvent(task, evt));
        }
        task.status = 'done';
        task.percent = 100;
        task.message = '拉取完成';
        task.updatedAt = Date.now();
      } catch (error: unknown) {
        logger.error(`镜像拉取失败 (${imageName}):`, error);
        task.status = 'error';
        task.error = getErrorMessage(error);
        task.message = '拉取失败';
        task.updatedAt = Date.now();
      }
    })();

    res.json({ success: true, data: { taskId } });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// 镜像拉取进度查询（前端轮询；须注册在 GET /:id 之前避免被捕获）
router.get('/pull/status/:taskId', (req: Request, res: Response) => {
  const task = pullTasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ success: false, message: '任务不存在或已过期' });
  res.json({ success: true, data: task });
});

// POST /sync — 同步镜像数据
// 接受 serverId/endpointId，明确目标主机
router.post('/sync', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const { serverId, endpointId } = req.body as { serverId?: string; endpointId?: string };
    const targetEndpoint = endpointId || serverId;

    if (targetEndpoint) {
      // 多主机：拉取目标主机的镜像列表
      const d = multiHostDockerService.getDockerClient(targetEndpoint);
      const imgs = await d.listImages();
      // 简单映射到标准结构
      const mapped = imgs.map((img: any) => ({
        id: img.Id,
        tags: img.RepoTags || [],
        repository: img.RepoTags?.[0]?.split(':')[0] || '<none>',
        tag: img.RepoTags?.[0]?.split(':')[1] || '<none>',
        size: img.Size,
        created: img.Created,
        virtualSize: img.VirtualSize,
        labels: img.Labels,
      }));
      res.json({
        success: true,
        message: `同步完成（目标端点: ${targetEndpoint}）`,
        data: mapped,
        endpointId: targetEndpoint,
      });
    } else {
      const allImages = await dockerService.listImages();
      res.json({ success: true, message: '镜像数据同步完成', data: allImages });
    }
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /prune — 批量清理未使用镜像
router.post('/prune', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const d = getDocker(req);
    const result = await (d as any).pruneImages({ filters: { dangling: { 'true': true } } });
    res.json({
      success: true,
      data: {
        imagesDeleted: result.ImagesDeleted || [],
        spaceReclaimed: result.SpaceReclaimed || 0,
      },
    });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /:id — 镜像详情
router.get('/:id', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const endpointId = req.query.endpointId as string | undefined;
    let image: DockerImage;
    if (endpointId && endpointId !== 'local') {
      const d = getDocker(req);
      const info = await d.getImage(req.params.id).inspect();
      image = normalizeImage(info);
    } else {
      image = await dockerService.getImageInfo(req.params.id);
    }
    res.json({ success: true, data: image });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 404;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /:id — 删除镜像
router.delete('/:id', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const endpointId = req.query.endpointId as string | undefined;
    if (endpointId && endpointId !== 'local') {
      const d = getDocker(req);
      await d.getImage(req.params.id).remove({ force: req.query.force === 'true' });
    } else {
      const force = req.query.force === 'true';
      const noprune = req.query.noprune === 'true';
      await dockerService.removeImage(req.params.id, force, noprune);
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
