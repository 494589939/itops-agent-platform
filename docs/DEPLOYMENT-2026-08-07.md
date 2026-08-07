# ITOps Agent Platform — 部署与启动文档

**版本**: v3.0.5（2026-08-07 第二轮修复）  
**适用代码版本**: Commit `main` HEAD（截至 2026-08-07）

---

## 一、系统要求

| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Windows 10/11 / macOS 12+ / Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| Node.js | 20.19.5+（必须，better-sqlite3 编译依赖） | 20.19.5 LTS |
| Docker | 24.0+（含 Docker Compose v2） | Docker 25+ |
| CPU | 2 核 | 4 核+ |
| 内存 | 6 GB | 8 GB+ |
| 磁盘 | 15 GB（镜像 + 数据） | 30 GB+ SSD |
| 浏览器 | Chrome 110+ / Edge 110+ / Firefox 110+ | Chrome 最新稳定版 |

> **Windows 用户注意**：请先安装 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) 并启用 WSL2。

---

## 二、部署方式对比

| 部署方式 | 适用场景 | 难度 | 数据持久化 | 热重载 |
|----------|----------|------|------------|--------|
| **Docker Compose（推荐）** | 快速体验、本地开发、功能验证 | ⭐ | ✅ Docker volume | ✅ 前端+后端 |
| 本地裸机部署 | 无 Docker 环境、深度二次开发 | ⭐⭐⭐ | ✅ 本地文件 | ✅ Vite + tsx watch |
| 生产级 K8s/Docker | 正式对外服务 | ⭐⭐⭐⭐ | ✅ PV/PVC 或外部 DB | ❌ |

---

## 三、方式一：Docker Compose 部署（推荐）

### 3.1 获取代码

```bash
git clone https://github.com/494589939/itops-agent-platform.git
cd itops-agent-platform
```

### 3.2 启动（一行命令）

```bash
cd local-dev

# Windows
.\start-dev.bat --build

# macOS / Linux
chmod +x start-dev.sh && ./start-dev.sh --build
```

> `--build`：首次启动或修改了 `package.json` 时加；普通重启可省略。

或者直接用 docker compose：

```bash
cd local-dev
docker compose up -d --build     # 后台启动（推荐）
# 或者 docker compose up          # 前台启动，看日志
```

首次构建约 3-8 分钟（取决于网络速度），后续启动秒级。

### 3.3 验证启动

等待约 2 分钟后（首次需要 npm install + 编译），逐一验证：

| 验证项 | 命令 / 操作 | 预期结果 |
|--------|------------|----------|
| 容器运行状态 | `docker compose ps` | `backend` 和 `frontend` 状态均为 `Up (healthy)` |
| 后端探活 | `curl http://localhost:3001/health/live` | 返回 `{"status":"healthy"}` 200 |
| 后端就绪 | `curl http://localhost:3001/health/ready` | 返回 `{"status":"ready","checks":{"db":"ok"}}` 200 |
| 前端页面 | 浏览器打开 `http://localhost:5173` | 显示登录页，无控制台红色报错 |
| API 文档 | 浏览器打开 `http://localhost:3001/api-docs` | Swagger UI 正常渲染 |
| 登录 | 用户名 `admin`，密码 `admin` | 首次登录强制改密，成功后进入首页 |

### 3.4 停止

```bash
cd local-dev

# Windows
.\stop-dev.bat          # 停止（保留数据库）
.\stop-dev.bat --clean  # 停止 + 清空所有数据（数据库/上传/备份）
.\stop-dev.bat --images # 停止 + 删除本地镜像

# macOS / Linux
./stop-dev.sh           # 同上
./stop-dev.sh --clean
./stop-dev.sh --images
```

### 3.5 端口说明

| 端口 | 绑定地址 | 服务 | 说明 |
|------|---------|------|------|
| **3001** | 127.0.0.1 | 后端 API + Swagger + Socket.IO | 所有 REST 和 WebSocket |
| **5173** | 127.0.0.1 | 前端 Vite Dev Server | 浏览器访问入口 |
| **9229** | 127.0.0.1 | Node.js 调试端口 | Chrome `chrome://inspect` |

> 所有端口默认仅绑定 `127.0.0.1`，不会被公网访问。若需局域网访问，修改 `docker-compose.yml` 中 `ports:` 去掉 `127.0.0.1:` 前缀。

---

## 四、方式二：本地裸机部署（Node.js 直接运行）

适用于没有 Docker，或需要深度调试的场景。

### 4.1 安装 Node.js 20

**必须是 20.19.5+**，否则 `better-sqlite3` 编译会失败。

```bash
# 推荐用 nvm 管理
nvm install 20.19.5
nvm use 20.19.5

# 验证
node -v   # → v20.19.5 或更高
npm -v    # → 10.x+
```

### 4.2 后端启动

```bash
cd backend

# 安装依赖（首次 2-5 分钟）
npm install

# 可选：环境变量（全部有默认值，JWT_SECRET 建议改）
export NODE_ENV=development
export PORT=3001
export JWT_SECRET=your-safe-jwt-secret
export DATABASE_PATH=./data/app.db
export LOG_LEVEL=debug

# 开发模式（热重载，推荐）
npm run dev

# 或者 构建后运行
npm run build
npm start
```

成功标志：控制台出现 `🚀 Server listening on port 3001`。

### 4.3 前端启动（另开一个终端）

```bash
cd frontend

# 安装依赖
npm install

# 启动 Vite 开发服务器（默认 http://localhost:5173）
npm run dev
```

成功标志：控制台出现 `Local: http://localhost:5173/`。

### 4.4 验证

同 3.3 节，访问 `http://localhost:5173` 登录即可。

---

## 五、AI 模型配置（可选）

AI 模块使用国内大模型，配置方式有两种：

| 方式 | 适用 | 持久化 | 优先级 |
|------|------|--------|--------|
| **前端 Web UI**（推荐） | 日常使用 | ✅ 写入 DB，重启保留 | 低 |
| 环境变量 | Docker / CI 自动化 | ❌ 随容器生命周期 | 高 |

### 方式一：Web UI 配置（推荐）

1. 登录后进入右上角 **设置 → AI 配置**
2. 选择要启用的模型（如豆包），填入：
   - API Key：从对应厂商控制台获取
   - API Base：豆包默认 `https://ark.cn-beijing.volces.com/api/v3`
   - Model：如 `doubao-4o`
3. 点击 **测试连接**，确认成功后 **保存**

### 方式二：Docker 环境变量注入

编辑 `local-dev/docker-compose.yml` 找到 `backend` 的 `environment:` 段：

```yaml
environment:
  - DOUBAO_API_KEY=your-ark-api-key
  - DOUBAO_API_BASE=https://ark.cn-beijing.volces.com/api/v3
  - DOUBAO_MODEL=doubao-4o
```

然后重启后端：

```bash
cd local-dev
docker compose restart backend
```

---

## 六、升级指南（从旧版本升级到 v3.0.5）

### 6.1 Docker Compose 用户（最常见）

```bash
cd itops-agent-platform/local-dev

# 1. 先停止
docker compose down

# 2. 拉取最新代码
cd ..
git pull origin main

# 3. 重新构建并启动（含两次修复的最新代码）
cd local-dev
docker compose up -d --build

# 4. 等 1-2 分钟后验证
docker compose ps
# → 两个服务都是 Up (healthy)
```

### 6.2 本地裸机用户

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 确认依赖没变化（可选，保险）
cd backend && npm install
cd ../frontend && npm install
cd ..

# 3. 重启前后端两个进程（ctrl-c 后重新 npm run dev）
```

### 6.3 升级验证清单

升级后按顺序验证：

- [ ] `docker compose ps` 所有服务 healthy
- [ ] `curl http://localhost:3001/health/ready` → db: ok
- [ ] 浏览器登录首页，控制台无红色报错
- [ ] 进入 **容器管理** → **容器列表**，能正常显示表格
- [ ] 点击容器进入详情，点击 **日志 / 统计** 无崩溃
- [ ] 进入 **数据中心** → **3D 大屏** 正常渲染，无 TypeError
- [ ] 进入 **告警中心** → **告警规则** 能正常编辑保存
- [ ] 进入 **工作流** → 新建一个简单的 `condition → action` 流程执行成功（不报错 false 永远为 truthy）

> 本次升级 **不涉及数据库 schema 变更**，因此 **不需要手动跑迁移**，也 **不需要备份后再升级**。但数据库仍建议定期导出备份（见下节）。

---

## 七、常用运维命令速查

### 7.1 Docker Compose

```bash
cd local-dev

# 服务状态
docker compose ps

# 实时日志
docker compose logs -f              # 所有服务
docker compose logs -f --tail=200 backend   # 只看后端最近 200 行
docker compose logs -f frontend     # 只看前端

# 重启
docker compose restart              # 全部
docker compose restart backend      # 只重启后端

# 进入容器
docker compose exec backend sh      # 后端容器 shell
docker compose exec backend env     # 看后端环境变量
```

### 7.2 数据备份与恢复

#### 备份

```bash
# 1. 导出数据库到备份文件（推荐先短暂停写操作）
cd local-dev
docker compose exec backend cp /app/data/app.db /app/backups/app-$(date +%Y%m%d-%H%M).db

# 2. 查看 volume 物理位置（如需从宿主机复制）
docker volume inspect local-dev_dev-data
# 找 Mountpoint，复制对应 app.db 即可
```

#### 恢复

```bash
# 把备份 db 文件名改回 app.db，放回 volume 挂载目录，重启后端
docker compose restart backend
```

### 7.3 本地裸机常用

```bash
# 后端
cd backend
npm run build      # 编译 TypeScript
npm run lint       # ESLint 检查
npm run test       # 后端单元测试

# 前端
cd frontend
npm run build      # 生成生产构建产物到 dist/
npm run preview    # 预览生产构建（模拟 Vite build 后的产物）
npm run lint       # ESLint 检查
```

---

## 八、常见问题 FAQ

### Q1：`npm install better-sqlite3` 编译失败

**原因**：Node.js 版本不对，或者缺少编译工具链。

**解决**：
```bash
# 1. 确认 Node.js 版本 ≥ 20.19.5
node -v
# 不对则用 nvm install 20.19.5

# 2. 若仍失败，全局安装编译工具（Windows 不用单独装，npm 会自动调用 vs build tools）
# Ubuntu:
sudo apt-get install -y build-essential python3
```

### Q2：前端 5173 打开空白，控制台报 `connect ECONNREFUSED 127.0.0.1:3001`

**原因**：后端未启动或未就绪。

**排查**：
```bash
# 检查后端健康
curl http://localhost:3001/health/live
# 或 Docker 里
docker compose logs --tail=100 backend
```

常见：首次启动 npm install 慢，等 `backend` 变成 `(healthy)` 再刷新。

### Q3：容器列表页白屏报错 `rawData.some is not a function`

**原因**：旧版缓存导致。请确认已升级到本次修复版本（commit 包含 `containers.service.ts` 修复）。

**解决**：
```bash
# 清浏览器缓存 + 强制刷新（Ctrl+Shift+R 或 Cmd+Shift+R）
# 或者 docker compose restart backend
```

### Q4：浏览器控制台有 `Static function can not consume context` 警告

**原因**：这是旧代码 antd message 静态方法问题。本次修复已用 `antdMessage` 全局代理替换了 26 处静态调用。

**解决**：拉取最新代码并 `docker compose up -d --build` 即可消除。

### Q5：启动报 `Bind for 0.0.0.0:3001 failed: port is already allocated`

**原因**：3001 / 5173 端口被其他程序占了。

**解决**：改 `local-dev/docker-compose.yml` 的 `ports:` 段：
```yaml
ports:
  - "3002:3001"   # 宿主 3002 → 容器 3001
  - "5174:3000"   # 宿主 5174 → 容器 3000
```
然后访问 `http://localhost:5174`。

### Q6：工作流 condition 判断 `false` 仍走了 true 分支

**原因**：这是 2026-08-07 修复的 CRITICAL BUG（`evaluateExpression` 永远返回字符串）。

**解决**：拉取最新代码即可，`evaluateExpression` 已支持 boolean/number/array/object 类型还原。

### Q7：VNC 连接一次后，断开重连，键盘输入串到前一个会话

**原因**：这是 2026-08-07 修复的 HIGH BUG（监听器累积）。

**解决**：拉取最新代码重新构建启动即可。

### Q8：想完全重置所有数据，回到首次启动状态

```bash
cd local-dev
# Windows
.\stop-dev.bat --clean
.\start-dev.bat --build

# Linux/Mac
./stop-dev.sh --clean
./start-dev.sh --build
```
所有数据库、上传文件、备份全部清空，回到首次登录改密的状态。

---

## 九、生产部署参考（简述）

Docker Compose 的 `local-dev/` 方案仅用于 **开发和验证**。正式生产请遵循以下原则：

1. **TLS/HTTPS**：前置 Nginx/Caddy 反向代理，开启 TLS（Let's Encrypt），对外只开放 443
2. **JWT_SECRET**：使用 32 字节以上随机字符串（`openssl rand -hex 32`）
3. **数据库**：生产建议迁移到 **MySQL 8 / PostgreSQL**，避免 SQLite 并发写入瓶颈
4. **日志**：接入 ELK / Loki，不要只看 json-file
5. **监控**：`/health/live` 和 `/health/ready` 接入负载均衡健康检查
6. **备份**：定时脚本 `pg_dump` / `mysqldump` + 冷备，至少保留 7 天异地备份
7. **Docker socket**：生产 **不要** 挂载 `/var/run/docker.sock` 到容器（等同于宿主机 root），改为 Docker Swarm / K8s API 或单独的 Docker 代理服务

---

## 十、相关文档

- 本地开发环境细节：[local-dev/README.md](../local-dev/README.md)
- 第一轮发布说明（容器/安全/前端崩溃）：[RELEASE-NOTES-2026-08-06.md](./RELEASE-NOTES-2026-08-06.md)
- 第二轮发布说明（全项目审查 25 个 BUG）：[RELEASE-NOTES-2026-08-07.md](./RELEASE-NOTES-2026-08-07.md)

---

**如仍有启动问题，请附带以下信息提交 Issue：**

```bash
# 1. 环境
node -v && docker version && docker compose version

# 2. 服务状态
cd local-dev && docker compose ps

# 3. 后端错误日志（最后 150 行）
docker compose logs --tail=150 backend

# 4. 前端错误日志（最后 100 行）
docker compose logs --tail=100 frontend
```
