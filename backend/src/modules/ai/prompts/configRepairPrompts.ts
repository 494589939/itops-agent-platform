/**
 * =============================================================================
 * 配置修复 AI Prompt 模板
 * =============================================================================
 */

export const CONFIG_REPAIR_PROMPTS = {
  /**
   * 分析配置问题
   */
  analyzeConfig: (configContent: string, configPath: string, serverInfo: string) => `
你是一个专业的运维配置分析专家。请分析以下配置文件，识别潜在问题。

配置文件路径: ${configPath}
服务器信息: ${serverInfo}

配置内容:
\`\`\`
${configContent}
\`\`\`

请分析并找出以下类型的问题：
1. 安全问题 - 不安全的配置项
2. 性能问题 - 可能影响性能的配置
3. 最佳实践 - 不符合行业最佳实践的配置
4. 语法问题 - 潜在的语法错误

对于每个问题，请提供：
- 问题描述
- 严重级别 (critical/high/medium/low)
- 当前值
- 建议值
- 是否可以自动修复

请以JSON格式输出，格式如下：
\`\`\`json
{
  "issues": [
    {
      "type": "security|performance|bestPractice|syntax",
      "severity": "critical|high|medium|low",
      "description": "问题描述",
      "lineNumber": 行号,
      "key": "配置项名称",
      "currentValue": "当前值",
      "suggestedValue": "建议值",
      "fixable": true|false
    }
  ]
}
\`\`\`
`,

  /**
   * 生成修复方案
   */
  generateRepairPlan: (issues: string, configPath: string) => `
你是一个运维修复方案生成专家。请根据以下问题生成修复方案。

配置文件: ${configPath}
发现的问题:
${issues}

请生成详细的修复方案，包括：
1. 修复步骤
2. 预期效果
3. 风险评估
4. 回滚方案
5. 验证方法

请以清晰的格式输出。
`,

  /**
   * 验证修复结果
   */
  verifyRepair: (originalContent: string, newContent: string, configPath: string) => `
你是一个配置验证专家。请对比修复前后的配置文件，验证修复是否正确。

配置文件: ${configPath}

修复前:
\`\`\`
${originalContent}
\`\`\`

修复后:
\`\`\`
${newContent}
\`\`\`

请验证：
1. 语法是否正确
2. 变更是否符合预期
3. 是否引入新问题
4. 建议的验证命令

请以清晰的格式输出验证结果。
`,

  /**
   * 分析配置变更影响
   */
  analyzeImpact: (changes: string, configPath: string) => `
你是一个变更影响分析专家。请分析以下配置变更可能产生的影响。

配置文件: ${configPath}
计划的变更:
${changes}

请分析：
1. 对系统性能的影响
2. 对安全性的影响
3. 对其他服务的影响
4. 需要验证的关键点
5. 回滚建议

请以清晰的格式输出。
`,

  /**
   * 自然语言转配置变更
   */
  naturalLanguageToChange: (userRequest: string, configContent: string) => `
你是一个配置变更翻译专家。请将用户的自然语言需求转换为具体的配置变更。

用户需求: ${userRequest}

当前配置内容:
\`\`\`
${configContent}
\`\`\`

请分析用户需求并生成配置变更方案，以JSON格式输出：
\`\`\`json
{
  "changes": [
    {
      "action": "modify|add|delete",
      "key": "配置项名称",
      "oldValue": "旧值（如果是修改）",
      "newValue": "新值",
      "description": "变更说明"
    }
  ],
  "explanation": "变更解释",
  "riskLevel": "low|medium|high",
  "validation": "验证命令"
}
\`\`\`
`,
};

export const CONFIG_KNOWLEDGE = {
  /**
   * Nginx 最佳实践
   */
  nginxBestPractices: `
Nginx 配置最佳实践：

1. worker_processes
   - 建议设置为: auto 或 CPU 核心数
   - 过高会导致上下文切换开销

2. worker_connections
   - 建议设置: 2048 或更高
   - 根据并发连接数调整

3. keepalive_timeout
   - 建议设置: 65s
   - 过长会占用连接资源

4. gzip
   - 建议启用 gzip 压缩
   - 压缩文本类型文件

5. server_tokens
   - 建议关闭: server_tokens off
   - 隐藏版本号增强安全

6. client_max_body_size
   - 根据需求设置
   - 避免过大导致攻击
`,

  /**
   * Sysctl 最佳实践
   */
  sysctlBestPractices: `
Sysctl 内核参数最佳实践：

1. vm.swappiness
   - 建议值: 10
   - 越低越倾向使用物理内存

2. vm.dirty_ratio
   - 建议值: 15-20
   - 脏页比例触发写回

3. net.core.somaxconn
   - 建议值: 65535
   - 增加连接队列长度

4. net.ipv4.tcp_max_syn_backlog
   - 建议值: 65535
   - SYN 队列长度

5. net.ipv4.ip_local_port_range
   - 建议值: 1024 65535
   - 增加可用端口范围

6. fs.file-max
   - 建议值: 1000000+
   - 系统最大文件描述符
`,

  /**
   * SSHD 安全最佳实践
   */
  sshdBasics: `
SSHD 安全最佳实践：

1. PermitRootLogin
   - 建议设置: no
   - 禁止 root 直接登录

2. PasswordAuthentication
   - 建议设置: no
   - 使用 SSH 密钥认证

3. PubkeyAuthentication
   - 建议设置: yes
   - 启用公钥认证

4. PermitEmptyPasswords
   - 建议设置: no
   - 禁止空密码

5. MaxAuthTries
   - 建议设置: 3-5
   - 限制认证尝试次数

6. ClientAliveInterval
   - 建议设置: 300
   - 空闲连接超时

7. Protocol
   - 建议设置: 2
   - 只使用 SSH 协议 v2
`,
};
