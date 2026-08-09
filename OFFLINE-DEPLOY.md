# ITOps Agent Platform — 内网离线部署完整指南

> 适用场景：生产/涉密内网**无法访问外网**（无 Docker Hub、无 npm 源、无 GitHub），需要把平台**完整打包**后一次性搬进内网启动。

平台由两个容器组成，全部组件已预编译（后端 tsc 编译产物 + 前端 Vite 静态包），**运行时无需联网、无需编译**：

| 组件 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| backend | `itops-backend:prod` | 3001 | API + AI Agent + 自愈/告警/自动化，SQLite 数据库 |
| frontend | `itops-frontend:prod` | 8080 | Nginx 托管前端页面，反向代理到后端 |

数据全部持久化在 Docker 命名卷（`itops-app-data`），**容器销毁/重建不丢数据**。

---

## 方案 A：镜像离线部署（推荐，内网免构建）

只需准备 **1 个镜像 tar 包 + 1 个 compose 文件**。

### A.1 在联网机器上导出镜像

```bash
# 1. 构建生产镜像（联网机，约 5-10 分钟；已有镜像可跳过）
docker compose build backend frontend

# 2. 确认镜像
docker images | grep itops
#    itops-backend:prod    ...
#    itops-frontend:prod   ...

# 3. 导出为 tar 包（同时导出，一个包即可）
docker save itops-backend:prod itops-frontend:prod -o itops-images.tar
# （也可分开导出：docker save itops-backend:prod -o itops-backend.tar 等）

# 4. 一并准备 compose 文件与说明文档
#    docker-compose.yml / .env / docker/.env.example
```

> 如需离线部署的**基础镜像**（内网机器没有 node 镜像时，方案 B 才需要）：
> ```bash
> docker pull node:20.19.5-bookworm-slim
> docker save node:20.19.5-bookworm-slim -o node-base.tar
> ```

### A.2 拷贝到内网机器

将以下文件通过 U 盘/内网共享/磁带拷贝到目标机：

```
itops-images.tar
docker-compose.yml          （项目根目录）
.env                        （可选，按需覆盖端口等）
```

### A.3 内网机器加载并启动

```bash
# 1. 安装 Docker（内网离线安装：rpm/deb 包或 yum/dnf 本地源，见下方备注）
#    启动 Docker 服务
sudo systemctl enable --now docker

# 2. 加载镜像
docker load -i itops-images.tar
docker images | grep itops     # 确认两个镜像已就位

# 3. 启动
docker compose up -d

# 4. 健康检查
docker compose ps
#    itops-backend  Up (healthy)    127.0.0.1:3001->3001
#    itops-frontend Up (healthy)    127.0.0.1:8080->80

# 5. 访问
#    浏览器打开 http://<内网IP>:8080
#    默认账号见系统初始化提示（首次登录后请立即修改密码）
```

### A.4 数据备份 / 迁移（可选）

```bash
# 备份（含数据库/上传/JWT secret）
docker run --rm -v itops-app-data:/data -v "$(pwd)":/backup \
  alpine tar czf /backup/itops-data-$(date +%F).tar.gz -C /data .

# 新机器恢复
docker run --rm -v itops-app-data:/data -v "$(pwd)":/backup \
  alpine tar xzf /backup/itops-data-2026-08-09.tar.gz -C /data
```

---

## 方案 B：源码离线构建（需要修改代码/二开时）

内网机器具备 Docker 构建能力，但**无外网**——需把源码 + 依赖一起带进去。

### B.1 联网机打包源码与依赖

```bash
# 1. 拉取代码
git clone https://github.com/494589939/itops-agent-platform.git
cd itops-agent-platform

# 2. 用联网机预装依赖并生成离线缓存（npm 离线包）
#    后端
cd backend && npm ci && npm pack 2>/dev/null; cd ..
#    npm 离线缓存目录（内网构建时 --offline 使用）
mkdir -p .offline-cache && npm config get cache >/dev/null
cd backend && npm ci --cache ../.offline-cache && cd ..
cd frontend && npm ci --cache ../.offline-cache && cd ..

# 3. 导出基础镜像（构建阶段需要，Dockerfile 里 FROM node:20.19.5-bookworm-slim）
docker pull node:20.19.5-bookworm-slim
docker save node:20.19.5-bookworm-slim -o node-base.tar

# 4. 打包整个项目（排除 node_modules 与 .git，体积更小）
tar --exclude='.git' --exclude='node_modules' \
  -czf itops-source.tar.gz .
```

### B.2 内网机器

```bash
# 1. 安装 Docker + 加载基础镜像
docker load -i node-base.tar

# 2. 解压源码
tar xzf itops-source.tar.gz && cd itops-agent-platform

# 3. 离线安装依赖（npm 使用离线缓存，不访问外网）
cd backend && npm ci --offline --cache ../.offline-cache && cd ..
cd frontend && npm ci --offline --cache ../.offline-cache && cd ..

# 4. 构建并启动（compose 已配置 image 名，构建结果直接覆盖）
docker compose build backend frontend
docker compose up -d

# 5. 健康检查与访问同上
```

> 若 Dockerfile 内 `npm ci` 也需离线：将 Dockerfile 中 `npm config set registry https://registry.npmmirror.com` 行删除/注释，并把项目内 `.npmrc`（如有）改为 `cache` 指向随包携带的 `.offline-cache`，或在构建机上用 `docker build --network=none` + 预置 node_modules 的镜像方案。

---

## 离线安装 Docker（内网机器无 Docker 时）

以 **CentOS/RHEL 系** 为例（联网机下载 rpm 包）：

```bash
# 联网机
#   yumdownloader docker-ce docker-ce-cli containerd.io docker-compose-plugin \
#     --resolve --destdir=docker-rpms/    （含所有依赖）
# 或使用本地 yum 源/离线 rpm 目录

# 内网机
sudo yum localinstall -y docker-rpms/*.rpm
sudo systemctl enable --now docker
sudo docker compose version   # 确认 compose 插件
```

> Windows Server：下载 Docker Desktop 离线安装包（`Docker Desktop Installer.exe`，安装时勾选"Use Windows containers"关闭即用 Linux 容器）；或用 WSL2 内安装 Docker Engine。
> Ubuntu/Debian：联网机下载 `docker-ce*.deb` 及依赖，内网 `dpkg -i *.deb`。

---

## 端口与网络配置

- 默认仅绑定 `127.0.0.1`（本机访问）。**内网其他机器访问**：编辑 `docker-compose.yml`，把 ports 中 `127.0.0.1:3001:3001`、`127.0.0.1:8080:80` 去掉 `127.0.0.1:` 前缀后重启。
- 防火墙放行：`sudo firewall-cmd --permanent --add-port=8080/tcp && sudo firewall-cmd --reload`（或安全组规则）。
- 前端 → 后端走容器网络自动代理，无需额外配置。

## 配置项（.env / docker-compose.yml）

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 3001 | 后端端口 |
| `DATABASE_PATH` | /app/data/app.db | SQLite 路径（卷内） |
| `JWT_SECRET` | 自动生成 | 自动生成并持久化到卷内 `.jwt-secret`，重建不失效 |
| `ALLOWED_ORIGINS` | localhost 系列 | 前端跨域白名单，内网 IP 访问需追加 |
| `LOG_LEVEL` | info | 日志级别 |

## 常见问题

1. **健康检查失败 / 一直 Starting**：`docker compose logs backend` 看日志；首次启动会执行数据库迁移，稍等 30-60s。
2. **修改过服务器/端口后访问不了**：确认 `ALLOWED_ORIGINS` 含你的访问域名/IP。
3. **AI 功能不可用**：AI 模型依赖外部 API（豆包/DeepSeek），内网需自行配置可达的模型网关或关闭 AI 特性；运维管理（服务器/容器/告警/自愈）不受影响。
4. **镜像版本升级**：联网机重新 `docker compose build` 后导出新 tar 替换即可，`docker compose up -d` 会用新镜像重建，数据卷不受影响。
5. **默认账号**：首次启动自动初始化管理员账号，请登录后立即在"系统设置"修改密码。

---

## 内网部署检查清单

- [ ] 内网机器已装 Docker + compose 插件
- [ ] `docker load` 已导入 `itops-backend:prod` / `itops-frontend:prod`（方案 B 还需 `node:20.19.5-bookworm-slim`）
- [ ] `docker-compose.yml`、`.env` 已就位，端口按需放开 `127.0.0.1` 绑定
- [ ] `docker compose up -d` 后 `docker compose ps` 显示 healthy
- [ ] 浏览器可访问 `http://<IP>:8080`，能登录
- [ ] 数据卷 `itops-app-data` 已做首次备份
