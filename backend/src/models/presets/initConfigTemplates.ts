import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

export async function initConfigTemplates(): Promise<void> {
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM config_templates').get() as { count: number };
  
  if (existingCount.count > 0) {
    return;
  }
  
  logger.info('Initializing default config templates...');

  const templates = [
    {
      id: uuidv4(),
      name: 'Nginx 基础配置',
      description: 'Nginx 主配置文件模板，适用于 Web 服务器基础配置修复',
      category: 'web_server',
      service_name: 'nginx',
      template_content: `user nginx;
worker_processes {{worker_processes}};
error_log /var/log/nginx/error.log {{error_log_level}};
pid /run/nginx.pid;

events {
    worker_connections {{worker_connections}};
}

http {
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout {{keepalive_timeout}};
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    {{http_custom_config}}
}`,
      variables: JSON.stringify([
        { name: 'worker_processes', description: '工作进程数', default: 'auto' },
        { name: 'error_log_level', description: '错误日志级别', default: 'warn' },
        { name: 'worker_connections', description: '每个进程最大连接数', default: '1024' },
        { name: 'keepalive_timeout', description: 'Keep-alive 超时时间(秒)', default: '65' },
        { name: 'http_custom_config', description: '自定义 HTTP 配置', default: '' }
      ]),
      os_type: 'linux',
      target_path: '/etc/nginx/nginx.conf',
      backup_before_apply: 1,
      restart_command: 'systemctl restart nginx',
      validation_command: 'nginx -t',
      is_system: 1
    },
    {
      id: uuidv4(),
      name: 'Nginx 虚拟主机配置',
      description: 'Nginx 虚拟主机配置文件模板，用于站点配置修复',
      category: 'web_server',
      service_name: 'nginx',
      template_content: `server {
    listen {{listen_port}};
    server_name {{server_name}};
    
    {{ssl_config}}
    
    root {{document_root}};
    index {{index_files}};
    
    access_log /var/log/nginx/{{server_name}}.access.log;
    error_log /var/log/nginx/{{server_name}}.error.log;
    
    location / {
        try_files $uri $uri/ {{fallback_uri}};
    }
    
    {{custom_location}}
}`,
      variables: JSON.stringify([
        { name: 'listen_port', description: '监听端口', default: '80' },
        { name: 'server_name', description: '服务器名称', default: 'example.com' },
        { name: 'ssl_config', description: 'SSL 配置', default: '' },
        { name: 'document_root', description: '文档根目录', default: '/var/www/html' },
        { name: 'index_files', description: '索引文件', default: 'index.html index.htm' },
        { name: 'fallback_uri', description: '回退 URI', default: '/index.html' },
        { name: 'custom_location', description: '自定义 location 配置', default: '' }
      ]),
      os_type: 'linux',
      target_path: '/etc/nginx/conf.d/{{server_name}}.conf',
      backup_before_apply: 1,
      restart_command: 'systemctl reload nginx',
      validation_command: 'nginx -t',
      is_system: 1
    },
    {
      id: uuidv4(),
      name: 'MySQL 配置文件',
      description: 'MySQL/MariaDB 配置文件模板，用于数据库配置修复',
      category: 'database',
      service_name: 'mysql',
      template_content: `[mysqld]
# 基础配置
user = mysql
pid-file = /var/run/mysqld/mysqld.pid
socket = /var/run/mysqld/mysqld.sock
basedir = /usr
datadir = {{datadir}}
tmpdir = /tmp

# 网络配置
bind-address = {{bind_address}}
port = {{port}}
max_connections = {{max_connections}}
max_connect_errors = 100000

# 字符集
character-set-server = {{character_set}}
collation-server = {{collation}}

# 日志
log_error = /var/log/mysql/error.log
slow_query_log = {{slow_query_log}}
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = {{long_query_time}}

# InnoDB 配置
innodb_buffer_pool_size = {{innodb_buffer_pool_size}}
innodb_log_file_size = {{innodb_log_file_size}}
innodb_file_per_table = {{innodb_file_per_table}}
innodb_flush_log_at_trx_commit = {{innodb_flush_log_at_trx_commit}}

# 缓存配置
query_cache_type = {{query_cache_type}}
query_cache_size = {{query_cache_size}}
tmp_table_size = {{tmp_table_size}}
max_heap_table_size = {{max_heap_table_size}}

{{custom_config}}

[mysqld_safe]
log_error = /var/log/mysql/error.log
pid_file = /var/run/mysqld/mysqld.pid`,
      variables: JSON.stringify([
        { name: 'datadir', description: '数据目录', default: '/var/lib/mysql' },
        { name: 'bind_address', description: '绑定地址', default: '127.0.0.1' },
        { name: 'port', description: '端口号', default: '3306' },
        { name: 'max_connections', description: '最大连接数', default: '151' },
        { name: 'character_set', description: '字符集', default: 'utf8mb4' },
        { name: 'collation', description: '排序规则', default: 'utf8mb4_unicode_ci' },
        { name: 'slow_query_log', description: '慢查询日志', default: '1' },
        { name: 'long_query_time', description: '慢查询阈值(秒)', default: '2' },
        { name: 'innodb_buffer_pool_size', description: 'InnoDB 缓冲池大小', default: '256M' },
        { name: 'innodb_log_file_size', description: 'InnoDB 日志文件大小', default: '64M' },
        { name: 'innodb_file_per_table', description: '每表独立表空间', default: '1' },
        { name: 'innodb_flush_log_at_trx_commit', description: '事务日志刷新策略', default: '1' },
        { name: 'query_cache_type', description: '查询缓存类型', default: '0' },
        { name: 'query_cache_size', description: '查询缓存大小', default: '0' },
        { name: 'tmp_table_size', description: '临时表大小', default: '16M' },
        { name: 'max_heap_table_size', description: '最大堆表大小', default: '16M' },
        { name: 'custom_config', description: '自定义配置', default: '' }
      ]),
      os_type: 'linux',
      target_path: '/etc/mysql/mysql.conf.d/mysqld.cnf',
      backup_before_apply: 1,
      restart_command: 'systemctl restart mysql',
      validation_command: 'mysqladmin ping',
      is_system: 1
    },
    {
      id: uuidv4(),
      name: 'Redis 配置文件',
      description: 'Redis 配置文件模板，用于缓存服务配置修复',
      category: 'cache',
      service_name: 'redis',
      template_content: `# Redis 配置文件

# 网络配置
bind {{bind_address}}
port {{port}}
tcp-backlog {{tcp_backlog}}
timeout {{timeout}}
tcp-keepalive {{tcp_keepalive}}

# 通用配置
daemonize {{daemonize}}
supervised {{supervised}}
pidfile {{pidfile}}
loglevel {{loglevel}}
logfile {{logfile}}
databases {{databases}}

# 快照配置
save {{save_intervals}}
stop-writes-on-bgsave-error {{stop_writes_on_bgsave_error}}
rdbcompression {{rdbcompression}}
rdbchecksum {{rdbchecksum}}
dbfilename {{dbfilename}}
dir {{dir}}

# 内存管理
maxmemory {{maxmemory}}
maxmemory-policy {{maxmemory_policy}}
maxmemory-samples {{maxmemory_samples}}

# 安全配置
requirepass {{requirepass}}
rename-command {{rename_commands}}

# 客户端配置
maxclients {{maxclients}}

# 追加文件模式
appendonly {{appendonly}}
appendfilename {{appendfilename}}
appendfsync {{appendfsync}}

{{custom_config}}`,
      variables: JSON.stringify([
        { name: 'bind_address', description: '绑定地址', default: '127.0.0.1' },
        { name: 'port', description: '端口号', default: '6379' },
        { name: 'tcp_backlog', description: 'TCP  backlog', default: '511' },
        { name: 'timeout', description: '客户端超时(秒)', default: '0' },
        { name: 'tcp_keepalive', description: 'TCP keepalive(秒)', default: '300' },
        { name: 'daemonize', description: '守护进程模式', default: 'no' },
        { name: 'supervised', description: '监督模式', default: 'no' },
        { name: 'pidfile', description: 'PID 文件', default: '/var/run/redis/redis-server.pid' },
        { name: 'loglevel', description: '日志级别', default: 'notice' },
        { name: 'logfile', description: '日志文件', default: '/var/log/redis/redis-server.log' },
        { name: 'databases', description: '数据库数量', default: '16' },
        { name: 'save_intervals', description: '保存间隔', default: '900 1 300 10 60 10000' },
        { name: 'stop_writes_on_bgsave_error', description: 'BGSAVE 错误时停止写入', default: 'yes' },
        { name: 'rdbcompression', description: 'RDB 压缩', default: 'yes' },
        { name: 'rdbchecksum', description: 'RDB 校验和', default: 'yes' },
        { name: 'dbfilename', description: 'RDB 文件名', default: 'dump.rdb' },
        { name: 'dir', description: '工作目录', default: '/var/lib/redis' },
        { name: 'maxmemory', description: '最大内存', default: '256mb' },
        { name: 'maxmemory_policy', description: '内存淘汰策略', default: 'noeviction' },
        { name: 'maxmemory_samples', description: '内存采样数', default: '5' },
        { name: 'requirepass', description: '密码(空表示无密码)', default: '' },
        { name: 'rename_commands', description: '重命名命令', default: '' },
        { name: 'maxclients', description: '最大客户端数', default: '10000' },
        { name: 'appendonly', description: 'AOF 模式', default: 'no' },
        { name: 'appendfilename', description: 'AOF 文件名', default: 'appendonly.aof' },
        { name: 'appendfsync', description: 'AOF 同步策略', default: 'everysec' },
        { name: 'custom_config', description: '自定义配置', default: '' }
      ]),
      os_type: 'linux',
      target_path: '/etc/redis/redis.conf',
      backup_before_apply: 1,
      restart_command: 'systemctl restart redis-server',
      validation_command: 'redis-cli ping',
      is_system: 1
    },
    {
      id: uuidv4(),
      name: 'SSH 服务配置',
      description: 'OpenSSH 服务配置文件模板，用于 SSH 服务配置修复',
      category: 'security',
      service_name: 'sshd',
      template_content: `# SSH 服务配置文件

# 网络配置
Port {{port}}
AddressFamily {{address_family}}
ListenAddress {{listen_address}}

# 协议和密钥
Protocol {{protocol}}
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
HostKey /etc/ssh/ssh_host_ed25519_key

# 日志
SyslogFacility {{syslog_facility}}
LogLevel {{log_level}}

# 认证配置
LoginGraceTime {{login_grace_time}}
PermitRootLogin {{permit_root_login}}
StrictModes {{strict_modes}}
MaxAuthTries {{max_auth_tries}}
MaxSessions {{max_sessions}}

# 公钥认证
PubkeyAuthentication {{pubkey_authentication}}
AuthorizedKeysFile {{authorized_keys_file}}

# 密码认证
PasswordAuthentication {{password_authentication}}
PermitEmptyPasswords {{permit_empty_passwords}}

# 挑战响应认证
ChallengeResponseAuthentication {{challenge_response_authentication}}

# PAM 认证
UsePAM {{use_pam}}

# X11 转发
AllowAgentForwarding {{allow_agent_forwarding}}
AllowTcpForwarding {{allow_tcp_forwarding}}
GatewayPorts {{gateway_ports}}
X11Forwarding {{x11_forwarding}}
X11DisplayOffset {{x11_display_offset}}
X11UseLocalhost {{x11_use_localhost}}

# 其他配置
PrintMotd {{print_motd}}
PrintLastLog {{print_last_log}}
TCPKeepAlive {{tcp_keep_alive}}
UseDNS {{use_dns}}
PidFile {{pid_file}}
MaxStartups {{max_startups}}
PermitTunnel {{permit_tunnel}}
ClientAliveInterval {{client_alive_interval}}
ClientAliveCountMax {{client_alive_count_max}}

{{custom_config}}`,
      variables: JSON.stringify([
        { name: 'port', description: 'SSH 端口', default: '22' },
        { name: 'address_family', description: '地址族', default: 'any' },
        { name: 'listen_address', description: '监听地址', default: '0.0.0.0' },
        { name: 'protocol', description: 'SSH 协议版本', default: '2' },
        { name: 'syslog_facility', description: 'Syslog 设备', default: 'AUTH' },
        { name: 'log_level', description: '日志级别', default: 'INFO' },
        { name: 'login_grace_time', description: '登录宽限时间(秒)', default: '120' },
        { name: 'permit_root_login', description: '允许 root 登录', default: 'prohibit-password' },
        { name: 'strict_modes', description: '严格模式', default: 'yes' },
        { name: 'max_auth_tries', description: '最大认证尝试次数', default: '6' },
        { name: 'max_sessions', description: '最大会话数', default: '10' },
        { name: 'pubkey_authentication', description: '公钥认证', default: 'yes' },
        { name: 'authorized_keys_file', description: '授权密钥文件', default: '.ssh/authorized_keys' },
        { name: 'password_authentication', description: '密码认证', default: 'no' },
        { name: 'permit_empty_passwords', description: '允许空密码', default: 'no' },
        { name: 'challenge_response_authentication', description: '挑战响应认证', default: 'no' },
        { name: 'use_pam', description: '使用 PAM', default: 'yes' },
        { name: 'allow_agent_forwarding', description: '允许 Agent 转发', default: 'yes' },
        { name: 'allow_tcp_forwarding', description: '允许 TCP 转发', default: 'yes' },
        { name: 'gateway_ports', description: '网关端口', default: 'no' },
        { name: 'x11_forwarding', description: 'X11 转发', default: 'no' },
        { name: 'x11_display_offset', description: 'X11 显示偏移', default: '10' },
        { name: 'x11_use_localhost', description: 'X11 使用 localhost', default: 'yes' },
        { name: 'print_motd', description: '打印 MOTD', default: 'no' },
        { name: 'print_last_log', description: '打印最后登录', default: 'yes' },
        { name: 'tcp_keep_alive', description: 'TCP KeepAlive', default: 'yes' },
        { name: 'use_dns', description: '使用 DNS', default: 'no' },
        { name: 'pid_file', description: 'PID 文件', default: '/var/run/sshd.pid' },
        { name: 'max_startups', description: '最大启动数', default: '10:30:100' },
        { name: 'permit_tunnel', description: '允许隧道', default: 'no' },
        { name: 'client_alive_interval', description: '客户端存活间隔(秒)', default: '0' },
        { name: 'client_alive_count_max', description: '客户端存活计数最大值', default: '3' },
        { name: 'custom_config', description: '自定义配置', default: '' }
      ]),
      os_type: 'linux',
      target_path: '/etc/ssh/sshd_config',
      backup_before_apply: 1,
      restart_command: 'systemctl restart sshd',
      validation_command: 'sshd -t',
      is_system: 1
    },
    {
      id: uuidv4(),
      name: '系统日志配置 (rsyslog)',
      description: 'rsyslog 系统日志配置模板，用于日志服务配置修复',
      category: 'logging',
      service_name: 'rsyslog',
      template_content: `# rsyslog 配置文件

# 模块加载
module(load="imuxsock")
module(load="imklog")

# 全局配置
$WorkDirectory /var/spool/rsyslog
$ActionFileDefaultTemplate RSYSLOG_TraditionalFileFormat
$FileOwner root
$FileGroup adm
$FileCreateMode 0640
$DirCreateMode 0755
$Umask 0022
$PrivDropToUser syslog
$PrivDropToGroup syslog

# 日志规则
auth,authpriv.*                 /var/log/auth.log
*.*;auth,authpriv.none          -/var/log/syslog
cron.*                          /var/log/cron.log
daemon.*                        -/var/log/daemon.log
kern.*                          -/var/log/kern.log
lpr.*                           -/var/log/lpr.log
mail.*                          -/var/log/mail.log
user.*                          -/var/log/user.log

# 日志轮转
mail.info                       -/var/log/mail.info
mail.warn                       -/var/log/mail.warn
mail.err                        /var/log/mail.err

*.=debug;\\
        auth,authpriv.none;\\
        news.none;mail.none     -/var/log/debug
*.=info;*.=notice;*.=warn;\\
        auth,authpriv.none;\\
        cron,daemon.none;\\
        mail.none               -/var/log/messages

# 远程日志
{{remote_logging}}

# 自定义规则
{{custom_rules}}`,
      variables: JSON.stringify([
        { name: 'remote_logging', description: '远程日志配置', default: '#*.* @remote-server:514' },
        { name: 'custom_rules', description: '自定义日志规则', default: '' }
      ]),
      os_type: 'linux',
      target_path: '/etc/rsyslog.conf',
      backup_before_apply: 1,
      restart_command: 'systemctl restart rsyslog',
      validation_command: 'rsyslogd -N1',
      is_system: 1
    }
  ];

  const insertStmt = db.prepare(`
    INSERT INTO config_templates (
      id, name, description, category, service_name, template_content,
      variables, os_type, target_path, backup_before_apply,
      restart_command, validation_command, is_system,
      usage_count, success_count, created_at, updated_at
    ) VALUES (
      @id, @name, @description, @category, @service_name, @template_content,
      @variables, @os_type, @target_path, @backup_before_apply,
      @restart_command, @validation_command, @is_system,
      0, 0, @created_at, @updated_at
    )
  `);

  const insertMany = db.transaction((ts: typeof templates) => {
    for (const t of ts) {
      insertStmt.run({
        ...t,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  });

  insertMany(templates);
  
  logger.info(`Created ${templates.length} default config templates`);
}
