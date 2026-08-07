/* eslint-disable @typescript-eslint/no-explicit-any */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../../../../utils/logger';

const execFileAsync = promisify(execFile);

// 白名单：vmId/name 只允许字母、数字、点、下划线、连字符，防止 shell 元字符注入
const VM_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * 校验 VM ID/名称，防止命令注入。
 * virsh 命令的参数（如 domstate/dumpxml/undefine 的 vmId）必须通过此校验。
 */
export function validateVMId(id: string): void {
  if (!id || !VM_ID_PATTERN.test(id)) {
    throw new Error(`Invalid VM id/name (only alphanumeric, dot, underscore, hyphen allowed): ${id}`);
  }
}

export interface KvmConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  private_key?: string;
}

/**
 * KVM/libvirt SSH 客户端：封装 SSH 远程命令执行和连接管理。
 *
 * 安全说明：使用 execFile（数组式 argv，不经本地 shell）替代 exec（字符串拼接，经 shell 解析），
 * 消除 $()、反引号、分号等 shell 元字符的本地命令注入风险。
 */
export class KvmSshClient {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly platformId: string;
  private password?: string;
  private privateKey?: string;
  private sshArgs: string[];
  private sshExecutable: string;
  private _connected = false;

  constructor(platformId: string, config: KvmConfig) {
    this.platformId = platformId;
    this.host = config.host || '';
    this.port = config.port || 22;
    this.username = config.username || 'root';
    this.password = config.password;
    this.privateKey = config.privateKey || config.private_key;
    const built = this.buildSSHArgs();
    this.sshExecutable = built.executable;
    this.sshArgs = built.args;
  }

  get connected(): boolean {
    return this._connected;
  }

  /**
   * 构建 SSH 命令的 argv 数组（不经 shell）。
   * 有密码时用 sshpass 包装；execFile 数组传参，密码不经 shell 解析。
   */
  private buildSSHArgs(): { executable: string; args: string[] } {
    const sshArgs: string[] = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ConnectTimeout=10',
      '-p', String(this.port),
    ];

    if (this.privateKey) {
      sshArgs.push('-i', this.privateKey);
    }

    sshArgs.push(`${this.username}@${this.host}`);

    if (this.password) {
      return {
        executable: 'sshpass',
        args: ['-p', this.password, 'ssh', ...sshArgs],
      };
    }

    return { executable: 'ssh', args: sshArgs };
  }

  async connect(): Promise<void> {
    try {
      logger.info(`🔌 正在连接 KVM/libvirt 主机: ${this.host}`);

      if (!this.host) {
        throw new Error('KVM 主机地址未配置');
      }

      const { stdout } = await this.execSSH('virsh version');
      logger.info(`✅ KVM/libvirt 连接成功 (${this.host}), 版本: ${stdout.trim()}`);
      this._connected = true;
    } catch (error) {
      logger.error('❌ KVM/libvirt 连接失败:', error);
      this._connected = false;
      throw new Error(error instanceof Error ? error.message : 'KVM SSH 连接失败');
    }
  }

  disconnect(): void {
    this._connected = false;
    logger.info('🔌 KVM/libvirt 已断开连接');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch {
      return false;
    } finally {
      this.disconnect();
    }
  }

  async ensureConnected(): Promise<void> {
    if (!this._connected) await this.connect();
  }

  /**
   * 在远程主机上执行命令。
   *
   * 安全说明：
   * - 使用 execFile（不经本地 shell），消除本地命令注入
   * - remoteCommand 仍在远程主机的登录 shell 中执行，调用方必须对参数做白名单校验
   *   （如 validateVMId），防止远程 shell 注入
   */
  async execSSH(remoteCommand: string): Promise<{ stdout: string; stderr: string }> {
    const args = [...this.sshArgs, remoteCommand];

    try {
      const { stdout, stderr } = await execFileAsync(this.sshExecutable, args, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });

      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error) {
      if (error && typeof error === 'object') {
        const err = error as any;
        if (err.killed) {
          throw new Error('SSH 命令执行超时 (30s)');
        }
        if (err.stdout) {
          return { stdout: err.stdout.trim(), stderr: (err.stderr || '').trim() };
        }
        throw new Error(`SSH 命令失败: ${err.stderr || err.message || 'Unknown'}`);
      }
      throw error;
    }
  }

  async waitForState(vmId: string, expectedState: string, timeout: number): Promise<void> {
    validateVMId(vmId);
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < timeout) {
      try {
        const { stdout } = await this.execSSH(`virsh domstate "${vmId}"`);
        if (stdout.trim().toLowerCase() === expectedState.toLowerCase()) {
          return;
        }
      } catch {
        // 查询失败忽略
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    logger.warn(`⚠️ KVM 虚拟机 ${vmId} 等待状态 ${expectedState} 超时`);
  }

  async getVMDetail(name: string): Promise<{ maxMem: number; vcpus: number }> {
    validateVMId(name);
    try {
      const { stdout } = await this.execSSH(`virsh dominfo "${name}"`);
      let maxMem = 0;
      let vcpus = 0;

      for (const line of stdout.split('\n')) {
        if (line.includes('Max memory:')) {
          maxMem = parseInt(line.replace(/\D/g, '')) || 0;
        }
        if (line.includes('CPU(s):')) {
          vcpus = parseInt(line.replace(/\D/g, '')) || 0;
        }
      }

      return { maxMem, vcpus };
    } catch {
      return { maxMem: 0, vcpus: 0 };
    }
  }
}
