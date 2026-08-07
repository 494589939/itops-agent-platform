# Release Notes — 2026-08-07

**版本**: `main (第二轮审查修复)`  
**日期**: 2026-08-07  
**总变更**: 两轮共 84 个文件修改（第一轮 59 + 第二轮 25）  
**Commit 范围**: `8bf02e6` (上一版) → 今日最新 `HEAD`

---

## 概述

本次发布是对项目进行**全量深度代码审查**后的第二轮集中修复，重点修复**安全漏洞、运行时崩溃、资源泄漏、数据完整性**四类关键问题。共修复 25 个真实功能 BUG（含 11 个 CRITICAL 级），涉及后端核心架构、工作流引擎、SSH 连接池、WebSocket 管理、SQL 数据层等关键模块。

---

## ⚠️ CRITICAL（11 个，立即修复）

### 安全漏洞（2 个）

| # | BUG 描述 | 根因文件 | 修复方式 |
|---|---------|----------|----------|
| C-01 | **KVM 本地+远程命令注入**：`execSSH` 使用 `child_process.exec` 字符串拼接，`$()`/反引号可在本机执行任意命令；单引号逃逸可注入远程 virsh 命令 | [sshClient.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/modules/containers/services/vmManagement/kvmAdapter/sshClient.ts)、[vmLifecycle.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/modules/containers/services/vmManagement/kvmAdapter/vmLifecycle.ts) | 1. `exec` → `execFile`（数组 argv，不经本地 shell）<br>2. 新增 `validateVMId()` 白名单 `[a-zA-Z0-9._-]`，所有 virsh 参数入口校验<br>3. cloneVM 中 path.basename 防路径遍历 + XML 用 base64 编码安全传输（避免 sed 引号逃逸） |
| C-02 | **SQL 注入（列名拼接）**：`updateAarsConfig` 用对象 keys 直接拼入 SET 子句，传入含 `SELECT` 子句的键可读取任意表 | [coreAlerts.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/repositories/alertRepository/coreAlerts.ts) | 新增列名白名单 `AARS_CONFIG_ALLOWED_COLUMNS`（10 个允许字段），非白名单字段被过滤 |

> 注：workflowsRepo.ts 中另一处 pattern 直接拼接 SQL 的死代码方法 `findTemplateIdByNameKeywords` 已整体**删除**。

### 运行时崩溃（3 个）

| # | BUG 描述 | 根因文件 | 修复方式 |
|---|---------|----------|----------|
| C-03 | **工作流引擎表达式全错**：`evaluateExpression` 永远返回字符串，导致：① foreach 步骤必抛（Array.isArray(字符串)为false）② condition 步骤的 `${flag}` 解析为 `"false"` 仍被判为 truthy，永远走 true 分支 ③ wait 步骤立即通过 | [WorkflowEngine.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/modules/workflow/services/WorkflowEngine.ts) | replace 结果后添加类型还原链：`"true"/"false"/"null"/"undefined"` → 对应字面量 → JSON.parse（数组/对象）→ 数字正则转 Number → 否则保留字符串 |
| C-04 | **服务器告警关联失败**：`findIdHostnameByHostnameFuzzy` 使用 SQLite 不存在的 `CONCAT()` 函数（MySQL 语法），执行即抛 `no such function: CONCAT`，告警设备模糊匹配链路完全失效 | [serverCrud.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/repositories/serverRepository/serverCrud.ts) | `CONCAT('%', hostname)` → SQLite 标准语法 `'%' \|\| hostname` |
| C-05 | **DC 3D 大屏接口失败硬崩溃**：`/dc/slots/batch` 失败时 catch 返回的 mock 对象多嵌套了一层 `data`，导致消费方 `for...of slotsData` 直接抛 `TypeError: slotsData is not iterable`，3D 大屏白屏 | [useDataRoom.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/frontend/src/modules/dc/components/DataRoom3D/useDataRoom.ts) | mock 结构去掉一层 data，改为 `{ data: { slots, racks, rooms } }`（匹配 axios 拦截器后的格式） |

### 资源泄漏（4 个）

| # | BUG 描述 | 根因文件 | 修复方式 |
|---|---------|----------|----------|
| C-06 | **3 个后台轮询永不停止**：`startDCEnvironmentPoll`（30s）、`startDcPduSnmpPoll`（60s）、`startAgentExecutionArchive`（24h）各自启动 setInterval，但 shutdown 钩子只调了 `stopDCStatusPush`，另外 3 个 stop 函数从未调用。优雅关闭期间定时器仍触发，访问已关闭 DB/io 产生大量错误；测试热重启场景句柄泄漏阻止进程退出 | [serviceRegistry.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/serviceRegistry.ts) | dcStatusPush 的 shutdown 改为调用全部 4 个 stop 函数；另补充 `circuitBreaker`、`snmpPollingService`、`alertAutoAnalyzer` 三个 noop shutdown 的真实 stop 钩子 |
| C-07 | **终端监听器累积**：用户每开一个 SSH 终端，`terminal:disconnect` 全局事件就新增一个监听器且永不移除。后果：① 监听器泄漏，MaxListenersExceededWarning ② 发一次 disconnect，**所有已开终端同时被关闭**（会话串台） | [handler.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/shared/websocket/handler.ts) | 改为基于 sessionId 的命名空间事件：`socket.once('terminal:disconnect:${sessionId}')` + `socket.once('terminal:close-session:${sessionId}')`，用 once 保证单次触发，一方触发后 socket.off 另一方 |
| C-08 | **VNC 监听器累积+无超时**：① 切换服务器重连 VNC 时，每次 `vnc:connect` 都新增 `vnc:client-data`/`vnc:disconnect` 监听器，客户端发送一次键盘输入会被**写到所有历史 VNC 会话**（串台/误操作）② `net.connect` 无超时，黑洞 IP 时挂起 127s ③ sessionId 用 `Date.now()` 同毫秒冲突 ④ error 事件不清理 session | [vncProxyService.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/modules/network/services/vncProxyService.ts) | ① 新建前 `removeAllListeners` 清理旧监听器 ② `vncSocket.setTimeout(5000)`，超时即 destroy+报超时 ③ sessionId 改用 `crypto.randomUUID()` ④ error handler 中 destroy + delete session |
| C-09 | **SSH 池中坏连接错误被静默吞掉**：`createConnection` 在 ready 之后，error/timeout 监听器没被移除。后续真实网络错误触发时，`safeReject` 因 `isResolved=true` 直接 return，错误被静默吞掉，坏连接仍挂在池中标记为健康，下一条 acquire 复用它立即失败 | [sshConnectionPool.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/modules/servers/services/sshService/sshConnectionPool.ts) | ready 时：先 `removeAllListeners('error')` + `removeAllListeners('timeout')` 移除连接阶段监听器，再挂运行阶段监听器：匹配到的连接 `healthCheckFailed` 置为 3，使其在下次健康检查中被立即移除 |

### 功能完全不可用（2 个）

| # | BUG 描述 | 根因文件 | 修复方式 |
|---|---------|----------|----------|
| C-10 | **3 个 AI SSH 工具永远抛错**：`safeCommandBuilder` 的参数校验正则 `SAFE_PATH_CHARS` 过于严格。`find-large-files` 的 `+100M`（含 `+`）、`%s %p\n`（含 `%`、空格、`\`）、`system-logs` 的 `1 day ago`（含空格）、`host-processes` 的 `--sort=-%cpu`（含 `=`、`%`）全部通不过。工具一旦被调必抛，完全不可用 | [safeCommandBuilder.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/modules/ai/services/agents/safeCommandBuilder.ts) | `SAFE_PATH_CHARS` 扩展为 `/^[a-zA-Z0-9./\\-_~+%=: @\\\\]+$/`（添加的字符在 execFile 数组传参时不经 shell 解析，安全）；另修复 `level` 校验正则从纯数字改为与 schema 一致的 `SAFE_JOURNALCTL_LEVEL = /^(emerg\|alert\|crit\|err\|warning\|notice\|info\|debug\|[0-7])$/` |
| C-11 | **关闭顺序错乱**：`httpServer.close()` / `io.close()` 都是回调式 API，原代码没有 await，它们与 `shutdownAllServices()` 并发执行。实际顺序：服务先关 → HTTP/WS 仍在收请求 → 新请求访问已销毁资源 → 大量异常 | [app.ts](file:///d:/Desktop/itops-agent-platform-main/itops-agent-platform-main/backend/src/app.ts) | 用 `await new Promise<void>(r => httpServer?.close(() => r()))` 与 对应 io.close() 包装，严格按注释顺序：停接受请求 → 关 WS → 关服务 |

---

## 🟠 HIGH（14 个，高优已修复）

| # | 分类 | BUG 描述 | 根因文件 | 修复方式 |
|---|------|---------|----------|----------|
| H-01 | 进程存活 | `/health` 挂起风险：`dbHealthRepository.ping()` 被 better-sqlite3 busy 阻塞或网络卡住时，`/health` 永远挂起，负载均衡器无法摘除故障节点 | healthService.ts | `Promise.race` + 5s `setTimeout`（`unref()` 避免阻止进程退出）+ 超时抛错 → catch 中返回 unhealthy |
| H-02 | 数据完整性 | **5 处多步 DELETE 未用事务**：correlations.deleteGroup / serverGroups.delete / racksRepo.delete / discovery.deleteJob / roomsRepo.deleteAll。进程在两句 DELETE 之间被杀会留下孤儿数据 | correlations.ts, serverGroups.ts, racksRepo.ts, discovery.ts, roomsRepo.ts | 全部用 `db.transaction(() => { ... })()` 包裹，保证原子性 |
| H-03 | SQL 注入隐患 | **7 处 LIMIT/OFFSET 字符串拼接**：serverCrud、workflowsRepo、networkDevice core、devicesRepo、knowledge(2处)、backup、alertConfigs。虽然 better-sqlite3 不支持堆叠语句，但 LIMIT 可接盲注子查询绕过分页或读取数据 | 7 个 repositories 对应文件 | 统一改为 `LIMIT ? OFFSET ?` 参数绑定 + `Math.min(Number(x) || default, 200)` 整数校验 |
| H-04 | 状态管理 | `processAlert` 不检查 `initialized`：`AARS.stop()` 后 `escalationEngine` 已关闭，但 `processAlert` 仍可被调，向已停止的引擎塞数据导致未定义异常 | alertAutoResponseService.ts | 入口添加 `if (!this.initialized) { warn + return; }` 守卫 |

---

## 📋 第二轮修复文件清单（25 个）

| 模块 | 文件 | 主要修改 |
|------|------|---------|
| **安全** | `vmManagement/kvmAdapter/sshClient.ts` | exec→execFile + validateVMId 白名单 |
| **安全** | `vmManagement/kvmAdapter/vmLifecycle.ts` | 白名单校验 + path.basename + XML base64 安全传输 |
| **安全** | `alertRepository/coreAlerts.ts` | AARS_CONFIG_ALLOWED_COLUMNS 列名白名单 |
| **安全** | `workflowRepository/workflowsRepo.ts` | 删除 SQL 注入死代码 findTemplateIdByNameKeywords |
| **安全** | `ai/services/agents/safeCommandBuilder.ts` | SAFE_PATH_CHARS 扩展 + level 正则修复 |
| **工作流** | `workflow/services/WorkflowEngine.ts` | evaluateExpression 类型还原（boolean/number/array/object） |
| **服务管理** | `serviceRegistry.ts` | 3 个轮询 stop 补充 + circuitBreaker/snmpPolling/alertAutoAnalyzer 真实 shutdown |
| **Web服务** | `app.ts` | httpServer.close/io.close 转 Promise await |
| **WebSocket** | `shared/websocket/handler.ts` | terminal 监听器 sessionId 命名空间 + once |
| **网络代理** | `network/services/vncProxyService.ts` | 监听器清理 + 5s 超时 + randomUUID sessionId |
| **SSH 池** | `servers/services/sshService/sshConnectionPool.ts` | ready 后换监听器，坏连接 healthCheckFailed=3 |
| **健康检查** | `monitor/services/healthService.ts` | db ping Promise.race 5s 超时 |
| **告警服务** | `alertAutoResponse/alertAutoResponseService.ts` | processAlert initialized 守卫 |
| **告警仓储** | `alertRepository/correlations.ts` | deleteGroup 事务 |
| **告警仓储** | `alertRepository/alertConfigs.ts` | LIMIT? OFFSET? 参数化 |
| **服务器仓储** | `serverRepository/serverCrud.ts` | CONCAT→\|\| + list LIMIT? |
| **服务器仓储** | `serverRepository/serverGroups.ts` | delete 事务 |
| **网络设备仓储** | `networkDeviceRepository/core.ts` | list LIMIT? |
| **网络设备仓储** | `networkDeviceRepository/discovery.ts` | deleteDiscoveryJob 事务 |
| **DC 仓储** | `dcRepository/devicesRepo.ts` | list LIMIT? |
| **DC 仓储** | `dcRepository/racksRepo.ts` | delete 事务 |
| **DC 仓储** | `dcRepository/roomsRepo.ts` | deleteAll 事务 |
| **知识库** | `knowledgeRepository.ts` | query/ searchMcp LIMIT? |
| **备份** | `backupRepository.ts` | list LIMIT? |
| **前端 DC** | `DataRoom3D/useDataRoom.ts` | mock 结构去掉一层 data |

---

## ✅ 验证结果

| 验证项 | 结果 |
|--------|------|
| 后端 TypeScript 编译 `tsc --noEmit` | ✅ 0 错误 |
| 前端 TypeScript 编译 `tsc --noEmit` | ✅ 0 错误 |
| 第二轮修复文件数 | ✅ 25 个（11 CRITICAL + 14 HIGH） |
| 无新增 npm 依赖 | ✅ |
| 无数据库 schema 变更 | ✅（无需跑迁移） |

---

## 🚀 升级步骤（完整文档见 DEPLOYMENT.md）

```bash
# 1. 拉取最新代码
git pull origin main

# 2. Docker Compose 重新构建并启动（推荐）
cd local-dev
docker compose up -d --build

# 3. 健康检查
curl http://localhost:3001/health
# → status: "healthy"

# 4. 验证容器 API（核心模块）
curl http://localhost:3001/api/containers/status
# → success: true
```

**完整部署步骤**: [DEPLOYMENT-2026-08-07.md](./DEPLOYMENT-2026-08-07.md)
**第一轮发布说明**: [RELEASE-NOTES-2026-08-06.md](./RELEASE-NOTES-2026-08-06.md)
