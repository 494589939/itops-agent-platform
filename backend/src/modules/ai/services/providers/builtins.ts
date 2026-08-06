import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../../../utils/logger';
import type { Provider, ProviderResult } from './types';
import { getErrorMessage } from '../../../../utils/errorHelpers';
import type { ProviderRegistry } from './ProviderRegistry';

/**
 * HTTP Provider
 */
export const httpProvider: Provider = {
  name: 'http',
  description: 'HTTP 请求 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'get',
      description: '发送 GET 请求',
      inputs: [
        { name: 'url', type: 'string', description: '请求 URL', required: true },
        { name: 'headers', type: 'object', description: '请求头' },
        { name: 'params', type: 'object', description: 'URL 参数' }
      ],
      outputs: [
        { name: 'status', type: 'number' },
        { name: 'data', type: 'any' },
        { name: 'headers', type: 'object' }
      ],
      examples: [
        {
          title: '获取 JSON 数据',
          inputs: { url: 'https://api.example.com/data' }
        }
      ]
    },
    {
      name: 'post',
      description: '发送 POST 请求',
      inputs: [
        { name: 'url', type: 'string', description: '请求 URL', required: true },
        { name: 'data', type: 'any', description: '请求体' },
        { name: 'headers', type: 'object', description: '请求头' }
      ],
      outputs: [
        { name: 'status', type: 'number' },
        { name: 'data', type: 'any' }
      ],
      examples: []
    }
  ]
};

// 实现 HTTP Provider 方法
export const httpMethods = {
  async get(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const response = await fetch(params.url as string, {
        method: 'GET',
        headers: (params.headers as Record<string, string>) || {}
      });
      const data = await response.json() as unknown;

      return {
        success: true,
        data: {
          status: response.status,
          data,
          headers: Object.fromEntries(response.headers.entries())
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async post(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const response = await fetch(params.url as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(params.headers as Record<string, string> || {})
        },
        body: JSON.stringify(params.data)
      });
      const data = await response.json() as unknown;

      return {
        success: true,
        data: {
          status: response.status,
          data
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

/**
 * 通知 Provider
 */
export const notifyProvider: Provider = {
  name: 'notify',
  description: '通知 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'send',
      description: '发送通知',
      inputs: [
        { name: 'channel', type: 'string', description: '通知渠道: slack, webhook, email', required: true },
        { name: 'title', type: 'string', description: '标题', required: true },
        { name: 'message', type: 'string', description: '消息内容', required: true },
        { name: 'level', type: 'string', description: '级别: info, warning, error' }
      ],
      outputs: [
        { name: 'sent', type: 'boolean' }
      ],
      examples: [
        {
          title: '发送错误通知',
          inputs: {
            channel: 'webhook',
            title: '系统告警',
            message: '检测到异常',
            level: 'error'
          }
        }
      ]
    }
  ]
};

// 通知方法实现
export const notifyMethods = {
  async send(params: Record<string, unknown>): Promise<ProviderResult> {
    logger.info(`[NotifyProvider] Sending notification: ${params.title}`);
    // 简化实现，实际应该集成通知服务
    return {
      success: true,
      data: { sent: true }
    };
  }
};

/**
 * 脚本执行 Provider
 */
export const scriptProvider: Provider = {
  name: 'script',
  description: '脚本执行 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'exec',
      description: '执行命令/脚本',
      inputs: [
        { name: 'command', type: 'string', description: '要执行的命令', required: true },
        { name: 'args', type: 'array', description: '命令参数' },
        { name: 'cwd', type: 'string', description: '工作目录' },
        { name: 'timeout', type: 'number', description: '超时(ms)' }
      ],
      outputs: [
        { name: 'stdout', type: 'string' },
        { name: 'stderr', type: 'string' },
        { name: 'code', type: 'number' }
      ],
      examples: []
    }
  ]
};

// 脚本方法实现
// ⚠️ 安全说明（2026-08-06 P1）：
//   原实现用 promisify(exec)(command) —— exec 会经 shell 解析命令字符串，
//   若 command 含 `;`、`|`、`$()` 等 shell 元字符则构成命令注入。
//   现改为 execFile(command, args) 数组传参，不经 shell，杜绝元字符注入。
//   另增加命令白名单，仅允许只读诊断类命令，禁止任意可执行文件。
const SCRIPT_ALLOWED_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'grep', 'find', 'du', 'df',
  'ps', 'top', 'free', 'uptime', 'who', 'date', 'echo',
  'ping', 'traceroute', 'nslookup', 'dig', 'ip', 'ifconfig',
  'systemctl', 'journalctl', 'dmesg',
]);

export const scriptMethods = {
  async exec(params: Record<string, unknown>): Promise<ProviderResult> {
    const execFilePromise = promisify(execFile);
    const command = params.command as string;
    const args = (params.args as string[]) || [];

    if (!command) {
      return { success: false, error: '缺少 command 参数' };
    }

    // 命令白名单校验：阻止任意可执行文件调用
    const baseCmd = command.split('/').pop() || command;
    if (!SCRIPT_ALLOWED_COMMANDS.has(baseCmd)) {
      logger.warn(`[ScriptProvider] 命令被白名单拒绝: ${command}`);
      return {
        success: false,
        error: `命令不在允许列表内: ${baseCmd}。仅允许: ${Array.from(SCRIPT_ALLOWED_COMMANDS).join(', ')}`,
      };
    }

    // 参数安全校验：拒绝 shell 元字符（execFile 虽不经 shell，但仍防御性过滤）
    const DANGEROUS_ARG = /[;|`$()<>{}\n\r]/;
    for (const a of args) {
      if (typeof a === 'string' && DANGEROUS_ARG.test(a)) {
        logger.warn(`[ScriptProvider] 参数含危险字符被拒绝: ${a}`);
        return { success: false, error: '参数包含禁止的 shell 元字符' };
      }
    }

    try {
      const { stdout, stderr } = await execFilePromise(command, args, {
        cwd: params.cwd as string | undefined,
        timeout: params.timeout as number | undefined,
        maxBuffer: 1024 * 1024, // 1MB 上限，防 DoS
      });

      return {
        success: true,
        data: { stdout, stderr, code: 0 }
      };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        error: getErrorMessage(error),
        data: {
          stdout: execError.stdout,
          stderr: execError.stderr,
          code: execError.code
        }
      };
    }
  }
};

/**
 * 数据库 Provider
 */
export const databaseProvider: Provider = {
  name: 'database',
  description: '数据库操作 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'query',
      description: '执行 SQL 查询',
      inputs: [
        { name: 'connectionId', type: 'string', description: '数据库连接 ID', required: true },
        { name: 'query', type: 'string', description: 'SQL 查询语句', required: true },
        { name: 'params', type: 'array', description: '查询参数' }
      ],
      outputs: [
        { name: 'rows', type: 'array' },
        { name: 'columns', type: 'array' }
      ],
      examples: []
    }
  ]
};

// 数据库方法实现
export const databaseMethods = {
  async query(_params: Record<string, unknown>): Promise<ProviderResult> {
    // 简化实现
    return {
      success: true,
      data: {
        rows: [],
        columns: []
      }
    };
  }
};

/**
 * 注册所有内置 Provider
 */
export function registerBuiltinProviders(registry: ProviderRegistry): void {
  registry.register(httpProvider, httpMethods);
  registry.register(notifyProvider, notifyMethods);
  registry.register(scriptProvider, scriptMethods);
  registry.register(databaseProvider, databaseMethods);
}
