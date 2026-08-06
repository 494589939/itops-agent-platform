/**
 * =============================================================================
 * Docker 管理服务 - 容器操作
 * =============================================================================
 */

import type Docker from 'dockerode';
import type { DockerServiceClass, DockerContainer, DockerContainerDetail, DockerContainerStats } from './dockerService';
import { PassThrough } from 'stream';
import { logger } from '../../../../utils/logger';

type DS = InstanceType<typeof DockerServiceClass>;

export async function impl_listContainers(service: DS, all = true): Promise<DockerContainer[]> {
  if (!service.initialized) throw new Error('Docker service not available');

  const containers = await service.docker.listContainers({ all });
  return containers.map(normalizeContainer);
}

/**
 * 将 dockerode 原始 ContainerInfo（PascalCase）归一化为 camelCase 结构。
 * 本地 dockerService.listContainers 与多主机路由共用此映射，保证前端拿到的字段大小写一致。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeContainer(c: any): DockerContainer {
  return {
    id: c.Id,
    name: c.Names[0]?.replace(/^\//, '') || 'unnamed',
    image: c.Image,
    imageId: c.ImageID,
    state: c.State,
    status: c.Status,
    ports: c.Ports,
    created: c.Created,
    labels: c.Labels,
    networkSettings: c.NetworkSettings,
    mountLabel: c.MountLabel || '',
  };
}

export async function impl_getContainer(service: DS, id: string): Promise<DockerContainerDetail> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  const info = await container.inspect();
  
  return {
    id: info.Id,
    name: info.Name.replace(/^\//, ''),
    image: info.Config.Image,
    imageId: info.Image,
    state: {
      status: info.State.Status,
      running: info.State.Running,
      paused: info.State.Paused,
      restarting: info.State.Restarting,
      startedAt: info.State.StartedAt,
      finishedAt: info.State.FinishedAt,
      exitCode: info.State.ExitCode,
      error: info.State.Error,
    },
    created: info.Created,
    config: {
      hostname: info.Config.Hostname,
      env: info.Config.Env,
      cmd: info.Config.Cmd,
      workingDir: info.Config.WorkingDir,
      labels: info.Config.Labels,
    },
    networkSettings: {
      ipAddress: (info.NetworkSettings as Record<string, unknown>).IPAddress as string || '',
      gateway: (info.NetworkSettings as Record<string, unknown>).Gateway as string || '',
      networks: info.NetworkSettings.Networks,
      ports: info.NetworkSettings.Ports,
    },
    mounts: info.Mounts,
    hostConfig: {
      restartPolicy: info.HostConfig.RestartPolicy,
      memory: info.HostConfig.Memory,
      cpuShares: info.HostConfig.CpuShares,
      privileged: info.HostConfig.Privileged,
    },
  };
}

export async function impl_startContainer(service: DS, id: string): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.start();
  logger.info(`Container ${id} started`);
}

export async function impl_stopContainer(service: DS, id: string, timeout = 10): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.stop({ t: timeout });
  logger.info(`Container ${id} stopped`);
}

export async function impl_restartContainer(service: DS, id: string, timeout = 10): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.restart({ t: timeout });
  logger.info(`Container ${id} restarted`);
}

export async function impl_removeContainer(service: DS, id: string, force = false, v = false): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.remove({ force, v });
  logger.info(`Container ${id} removed`);
}

export async function impl_getContainerLogs(service: DS, id: string, tail = 100, timestamps = true): Promise<string> {
  if (!service.initialized) throw new Error('Docker service not available');
  return collectContainerLogs(service.docker, id, { tail, timestamps });
}

/**
 * 一次性采集容器日志为字符串。
 *
 * dockerode 的 container.logs() 返回的是多路复用流（非 TTY 容器：每帧含 8 字节头），
 * 直接对其 .toString('utf-8') 会得到 '[object Object]'（流对象没有编码化的 toString），
 * 必须经 modem.demuxStream 拆分 stdout/stderr 后拼接为字符串。
 * 本地 service 与多主机路由共用此实现。
 */
export async function collectContainerLogs(
  docker: Docker,
  id: string,
  opts: { tail?: number; timestamps?: boolean } = {},
): Promise<string> {
  const container = docker.getContainer(id);
  // dockerode 无 follow 时返回 Buffer；follow:true 时返回 ReadableStream。
  // 重载按 follow 字面量分流返回类型，运行时统一断言为联合类型，下方按运行时类型分别处理。
  const stream = (await container.logs({
    stdout: true,
    stderr: true,
    tail: opts.tail ?? 100,
    timestamps: opts.timestamps ?? true,
  })) as Buffer | NodeJS.ReadableStream | string;

  // 兼容 dockerode 在部分场景返回 string / Buffer 的情况
  if (typeof stream === 'string') return stream;
  if (Buffer.isBuffer(stream)) return stream.toString('utf-8');

  return new Promise<string>((resolve, reject) => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const chunks: Buffer[] = [];
    const onData = (c: Buffer) => chunks.push(c);
    stdout.on('data', onData);
    stderr.on('data', onData);
    let pending = 2;
    const onEnd = () => {
      if (--pending === 0) resolve(Buffer.concat(chunks).toString('utf-8'));
    };
    stdout.on('end', onEnd);
    stderr.on('end', onEnd);
    stream.on('error', reject);
    stdout.on('error', reject);
    stderr.on('error', reject);
    docker.modem.demuxStream(stream, stdout, stderr);
  });
}

export async function impl_getContainerStats(service: DS, id: string): Promise<DockerContainerStats> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  const stats = await container.stats({ stream: false });
  
  // 计算 CPU 使用率（防御 systemDelta=0 / precpu 缺失 / online_cpus 缺失 → NaN、Infinity）
  const cpuDelta =
    (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
    (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta =
    (stats.cpu_stats?.system_cpu_usage ?? 0) -
    (stats.precpu_stats?.system_cpu_usage ?? 0);
  const onlineCpus = stats.cpu_stats?.online_cpus ?? 1;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;

  // 计算内存使用（防御 memoryLimit=0 → Infinity）
  const memoryUsage = (stats.memory_stats?.usage ?? 0) - (stats.memory_stats?.stats?.cache || 0);
  const memoryLimit = stats.memory_stats?.limit ?? 0;
  const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;
  
  return {
    cpuPercent: cpuPercent.toFixed(2),
    memory: {
      usage: memoryUsage,
      limit: memoryLimit,
      percent: memoryPercent.toFixed(2),
    },
    network: stats.networks,
    pids: stats.pids_stats?.current || 0,
    read: stats.read,
  };
}

export async function impl_pauseContainer(service: DS, id: string): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.pause();
  logger.info(`Container ${id} paused`);
}

export async function impl_unpauseContainer(service: DS, id: string): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');

  const container = service.docker.getContainer(id);
  await container.unpause();
  logger.info(`Container ${id} unpaused`);
}

/**
 * 创建并启动一个新容器副本（用于自动伸缩等场景）
 *
 * @param service dockerService 实例
 * @param image   镜像名（如 nginx:latest）
 * @param name    容器名（可选，自动伸缩会用带副本序号的命名规则）
 * @param options 其它配置：env / ports / restartPolicy / labels
 */
export async function impl_runContainer(
  service: DS,
  image: string,
  name?: string,
  options: {
    env?: string[];
    ports?: Array<string | { hostPort: number; containerPort: number }>;
    restartPolicy?: string;
    labels?: Record<string, string>;
  } = {}
): Promise<{ id: string; name: string }> {
  if (!service.initialized) throw new Error('Docker service not available');

  const config: Record<string, unknown> = { Image: image };
  if (name) config.name = name;

  const hostConfig: Record<string, unknown> = {};
  const exposedPorts: Record<string, unknown> = {};
  const portBindings: Record<string, unknown> = {};

  if (options.ports && options.ports.length > 0) {
    for (const p of options.ports) {
      if (typeof p === 'string') {
        const [hp, cp] = p.split(':');
        if (cp) {
          exposedPorts[`${cp}/tcp`] = {};
          portBindings[`${cp}/tcp`] = [{ HostPort: hp }];
        }
      } else {
        exposedPorts[`${p.containerPort}/tcp`] = {};
        portBindings[`${p.containerPort}/tcp`] = [{ HostPort: String(p.hostPort) }];
      }
    }
    if (Object.keys(exposedPorts).length) {
      config.ExposedPorts = exposedPorts;
      hostConfig.PortBindings = portBindings;
    }
  }
  if (options.restartPolicy) hostConfig.RestartPolicy = { Name: options.restartPolicy };
  if (options.labels) config.Labels = options.labels;
  if (options.env) config.Env = options.env;
  if (Object.keys(hostConfig).length) config.HostConfig = hostConfig;

  const container = await service.docker.createContainer(config);
  await container.start();
  logger.info(`Container created and started: ${name || container.id} (image=${image})`);
  return { id: container.id, name: name || container.id };
}

/**
 * 计算一组容器副本中 "健康且运行中" 的数量
 */
export function countRunningByNamePrefix(containers: DockerContainer[], namePrefix: string): number {
  return containers.filter(c => c.name.startsWith(namePrefix) && c.state === 'running').length;
}