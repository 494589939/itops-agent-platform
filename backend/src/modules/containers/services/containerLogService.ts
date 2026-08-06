import { PassThrough } from 'stream';
import { dockerService } from './dockerService';
import { logger } from '../../../utils/logger';
import type { Server as SocketIOServer } from 'socket.io';

interface LogStream {
  stream: NodeJS.ReadableStream;
  stdout: PassThrough;
  stderr: PassThrough;
  containerId: string;
}

class ContainerLogService {
  private streams: Map<string, LogStream> = new Map();
  private io: SocketIOServer | null = null;

  setIO(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * 开始流式传输容器日志到 WebSocket
   *
   * 复用 dockerService 的 Docker 客户端（与 isAvailable() 状态一致，避免重复
   * new Docker 导致多主机/可用性状态脱节）。
   *
   * 日志流是多路复用格式（非 TTY 容器：每帧含 8 字节头），必须经
   * modem.demuxStream 拆分 stdout/stderr；旧实现 chunk.slice(8) 会在
   * 跨帧 chunk / 多帧 chunk 时截断或错位日志内容。
   */
  async startLogStream(roomId: string, containerId: string, options: {
    tail?: number;
    follow?: boolean;
    timestamps?: boolean;
  } = {}): Promise<void> {
    if (this.streams.has(roomId)) {
      return; // 已在流式传输
    }
    if (!dockerService.isAvailable()) {
      throw new Error('Docker service not available');
    }

    try {
      const container = dockerService.docker.getContainer(containerId);

      // dockerode 的 logs() 按 follow 字面量重载分流返回类型：
      //   follow:true  → Promise<ReadableStream>
      //   follow:false → Promise<Buffer>
      // 这里 follow 是运行时 boolean（默认跟随），重载无法匹配；用 `as true` 命中「流」重载，
      // 再把结果断言为联合类型，运行时按 Buffer.isBuffer / typeof string 分支处理。
      const stream = (await container.logs({
        stdout: true,
        stderr: true,
        tail: options.tail || 500,
        follow: (options.follow !== false) as true, // 默认跟随
        timestamps: options.timestamps !== false,
      })) as Buffer | NodeJS.ReadableStream | string;

      // 兼容 dockerode 在部分场景返回 string / Buffer（非流）的情况
      if (typeof stream === 'string' || Buffer.isBuffer(stream)) {
        // string 与 Buffer 的 toString 签名不同（string 不接受编码参数），分别处理
        const data = typeof stream === 'string' ? stream : stream.toString('utf-8');
        if (this.io) {
          this.io.to(roomId).emit('container:log:entry', {
            containerId,
            data,
            timestamp: new Date().toISOString(),
          });
        }
        logger.info(`📜 Log snapshot sent for container ${containerId} (room: ${roomId})`);
        return;
      }

      const stdout = new PassThrough();
      const stderr = new PassThrough();
      this.streams.set(roomId, { stream, stdout, stderr, containerId });

      const emitChunk = (chunk: Buffer) => {
        if (!this.io) return;
        this.io.to(roomId).emit('container:log:entry', {
          containerId,
          data: chunk.toString('utf-8'),
          timestamp: new Date().toISOString(),
        });
      };
      stdout.on('data', emitChunk);
      stderr.on('data', emitChunk);

      stream.on('error', (err: Error) => {
        logger.error(`Log stream error for ${containerId}:`, err.message);
        this.stopLogStream(roomId);
      });
      stream.on('end', () => {
        logger.info(`Log stream ended for ${containerId}`);
        this.stopLogStream(roomId);
      });

      dockerService.docker.modem.demuxStream(stream, stdout, stderr);

      logger.info(`📜 Log stream started for container ${containerId} (room: ${roomId})`);
    } catch (err) {
      logger.error(`Failed to start log stream for ${containerId}:`, err);
      throw err;
    }
  }

  /**
   * 停止日志流
   */
  stopLogStream(roomId: string): void {
    const entry = this.streams.get(roomId);
    if (entry) {
      this.destroyStream(entry.stream);
      this.destroyStream(entry.stdout);
      this.destroyStream(entry.stderr);
      this.streams.delete(roomId);
      logger.info(`📜 Log stream stopped for room: ${roomId}`);
    }
  }

  /**
   * 停止所有日志流
   */
  stopAll(): void {
    this.streams.forEach((entry) => {
      this.destroyStream(entry.stream);
      this.destroyStream(entry.stdout);
      this.destroyStream(entry.stderr);
    });
    this.streams.clear();
  }

  private destroyStream(s: NodeJS.ReadableStream | PassThrough): void {
    try {
      (s as { destroy?: () => void }).destroy?.();
    } catch {
      /* ignore */
    }
  }

  /**
   * 获取活跃的日志流数量
   */
  getActiveStreamCount(): number {
    return this.streams.size;
  }
}

export const containerLogService = new ContainerLogService();
