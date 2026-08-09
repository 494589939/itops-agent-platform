# ITOps Agent Platform

基于大语言模型的 IT 运维多 Agent 自动化平台。

[![License](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](../LICENSE)

## 功能特性

- **多 Agent 协作**：内置 9 个运维 Agent，支持自定义
- **可视化工作流编排**：拖拽式编辑器，支持串行/并行/条件分支
- **服务器管理**：SSH 远程连接、命令执行、13 项合规检查
- **告警中心**：支持 Prometheus/Zabbix Webhook 接入，自动降噪
- **知识库 + RAG**：智能检索注入 LLM 上下文
- **AI 助手**：自然语言对话式运维
- **多模型支持**：豆包、OpenAI API 接入
- **企业级安全**：AES-256-GCM 加密、JWT 认证、接口限流、审计日志

## 镜像拉取

```bash
# 后端 API
docker pull registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest
# 前端 Web
docker pull registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-frontend-latest
```

## 快速开始（Docker Compose）

```yaml
services:
  backend:
    image: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest
    container_name: itops-backend
    ports:
      - '3001:3001'
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOST=0.0.0.0
      - DATABASE_PATH=/app/data/app.db
    volumes:
      - app-data:/app/data
    restart: unless-stopped

  frontend:
    image: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-frontend-latest
    container_name: itops-frontend
    ports:
      - '8080:80'
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  app-data:
    driver: local
```

启动：

```bash
docker compose up -d
```

## 配置说明

**所有业务配置均通过前端 UI 管理，无需 `.env` 文件。**

部署完成后在 Web 界面配置：

| 配置项   | 位置                          | 说明                         |
| -------- | ----------------------------- | ---------------------------- |
| API Keys | `/settings` 页面              | 写入 `settings` 表           |
| AI 模型  | `/ai-models` 页面             | 写入 `ai_models` 表          |
| 通知渠道 | `/notification-settings` 页面 | 企业微信/飞书/钉钉等         |
| 告警源   | `/alert-providers` 页面       | Prometheus/Zabbix 等 Webhook |

仅以下基础配置支持环境变量：

| 变量              | 说明                                   | 默认值                  |
| ----------------- | -------------------------------------- | ----------------------- |
| `NODE_ENV`        | 运行环境                               | `production`            |
| `PORT`            | 后端端口                               | `3001`                  |
| `DATABASE_PATH`   | SQLite 数据库路径                      | `/app/data/app.db`      |
| `JWT_SECRET`      | JWT 签名密钥（可选，不设则自动生成）   | 自动生成并持久化        |
| `JWT_EXPIRES_IN`  | Token 有效期                           | `24h`                   |
| `ALLOWED_ORIGINS` | CORS 允许来源                          | `http://localhost:8080` |

## 文档

- 项目文档：[`docs/`](../docs/)
- 架构文档：[TECH_ARCHITECTURE.md](../.trae/documents/TECH_ARCHITECTURE.md)
- API 文档：启动后访问 `/api/v1/docs`

## 源码构建

```bash
docker build -f docker/Dockerfile.backend -t itops-backend:latest .
docker build -f docker/Dockerfile.frontend -t itops-frontend:latest .
docker compose up -d --build
```

## 使用说明

1. 访问前端 `http://localhost:8080`
2. 默认账号登录：`admin` / `admin`（⚠️ 首次登录请修改密码）
3. 在设置中配置 LLM API Key
4. 创建 Agent 与工作流，开始自动化运维

## 安全设计

- 服务器密码与 SSH 密钥 AES-256-GCM 加密存储
- JWT 认证 + Token 黑名单
- 接口限流
- 完整审计日志
- 敏感信息脱敏
- 容器内非 root 用户运行

## License

[MPL-2.0](../LICENSE) © 谭策
