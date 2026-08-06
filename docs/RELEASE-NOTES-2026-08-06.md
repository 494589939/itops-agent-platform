# Release Notes — 2026-08-06

**版本**: `4cfa898`  
**日期**: 2026-08-06  
**变更**: 59 个文件（+870 / -370）  

---

## 概述

本次发布聚焦三个方向：**容器模块 Bug 修复**、**全项目安全加固**、**前端运行时崩溃修复**。所有修改已通过 TypeScript 编译和本地 Docker 环境功能验证。

---

## 🐛 Bug 修复

### 容器管理模块（11 项）

- **SQL 注入防护**：存储卷更新操作添加列名白名单，仅允许预定义字段
- **CPU/内存统计 NaN**：容器统计计算添加除零保护，消除 NaN/Infinity 值
- **日志流截断**：使用 `modem.demuxStream` 替代手动 buffer 切片，正确处理 Docker 多路复用格式
- **多主机镜像操作**：镜像路由使用 `endpointId` 参数，支持多 Docker 主机
- **TLS 配置崩溃**：验证 `ca`/`cert`/`key` 三者完整性，缺失时不启用 TLS
- **字段命名归一化**：容器/镜像 API 统一返回 camelCase 字段名
- **DELETE 参数**：容器/镜像删除支持 `force`/`v` 查询参数
- **集群监控聚合**：快照聚合过滤 NaN 值，防止统计异常

### 前端崩溃修复（8 项）

- **容器列表崩溃**：修复 antd Table `dataSource` 收到 `{ items }` 对象而非数组导致的 `rawData.some is not a function` 崩溃
- **容器日志崩溃**：修复 `containers.filter is not a function`（同根因）
- **卷管理崩溃**：修复 `for...of` 迭代非数组值导致的 `data is not iterable` 崩溃
- **useMemo 防护**：5 个容器页面的 `useMemo` 添加 `Array.isArray` 防御检查，防止 HMR state 残留导致崩溃
- **受控输入警告**：通知设置页面 `controlled input changing to uncontrolled` 警告消除
- **Dockerfile 残留标签**：移除 `Dockerfile.frontend.dev` 中 CMD 指令的 `</new_str>` 标签，修复前端容器无限重启

---

## 🔒 安全加固

- **命令注入防护**：AI 工具脚本执行从 shell 模式改为 `execFile` 数组传参 + 命令白名单 + maxBuffer 限制
- **HTTP 安全头**：启用 `helmet` 中间件（CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy）
- **Body 大小限制**：`express.json()` 添加 2MB 限制，防止超大请求体 DoS

---

## 🔧 antd v5 兼容性

- **message 静态方法**：新建全局 `antdMessage` 代理，26 个文件迁移 import，解决 `Static function can not consume context` 警告，message 调用现在能获取动态主题
- **废弃属性迁移**：`destroyTooltipOnHide` → `destroyOnHidden`；`overlayInnerStyle` → `styles.body`

---

## 📦 升级注意事项

1. **无数据库迁移**：本次修改不涉及数据库 schema 变更
2. **无破坏性 API 变更**：所有 API 端点路径和响应格式保持兼容（camelCase 归一化使字段名更一致）
3. **前端依赖不变**：无新增 npm 依赖，`helmet` 已在 package.json 中
4. **本地部署**：拉取最新代码后重新 `docker compose -f local-dev/docker-compose.yml up -d --build` 即可

---

## ✅ 验证清单

- [x] TypeScript 编译 0 错误（前后端）
- [x] 后端 `/health` 返回 healthy
- [x] 容器 API 全功能测试通过（list/detail/stats/logs/images/volumes/networks/endpoints）
- [x] 安全头验证通过（7 个 helmet 头生效）
- [x] 浏览器控制台无崩溃/警告
- [x] 前端所有容器页面正常渲染

---

**完整变更清单**: [CHANGELOG-2026-08-06.md](./CHANGELOG-2026-08-06.md)  
**提交**: `4cfa898` on `main`
