import type { Migration } from './migrationFramework';

/**
 * Migration v018 — AARS v2 自适应告警响应系统 数据表
 *
 * 新增表：
 *   - aars_response_logs:     响应执行日志
 *   - aars_config:            系统配置
 *   - automata_trust:         自适应信任积累
 *   - probe_execution_stats:  探针执行统计
 */
const migration: Migration = {
  version: 18,
  id: '20240101000018',
  name: 'alert_auto_response_aars_v2',
  description: 'AARS v2 tables: response_logs, config, automata_trust, probe_execution_stats',
  async up(db) {
    // aars_response_logs — 每次响应的完整日志
    db.exec(`
      CREATE TABLE IF NOT EXISTS aars_response_logs (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        device_id TEXT,
        device_type TEXT,
        access_method TEXT,
        status TEXT NOT NULL DEFAULT 'identifying',
        probes_used TEXT,
        diagnosis_result TEXT,
        root_cause TEXT,
        remediation_plan TEXT,
        verification_result TEXT,
        execution_status TEXT,
        approval_status TEXT DEFAULT 'not_needed',
        notification_sent INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime')),
        completed_at TEXT,
        FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_aars_logs_alert ON aars_response_logs(alert_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_aars_logs_status ON aars_response_logs(status)`);

    // aars_config — 系统配置（单行）
    db.exec(`
      CREATE TABLE IF NOT EXISTS aars_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enabled INTEGER DEFAULT 1,
        min_severity TEXT DEFAULT 'medium',
        auto_execute_enabled INTEGER DEFAULT 1,
        approval_timeout_minutes INTEGER DEFAULT 30,
        max_concurrent INTEGER DEFAULT 5,
        ssh_timeout_sec INTEGER DEFAULT 30,
        verify_interval_sec INTEGER DEFAULT 30,
        notification_channels TEXT DEFAULT '["wecom","dingtalk","email"]',
        auto_execute_whitelist TEXT DEFAULT '["systemctl restart","logrotate","rm -rf /tmp/*"]',
        business_hours TEXT DEFAULT '{"start":"09:00","end":"18:00"}',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);

    // 插入默认配置
    const exists = db.prepare('SELECT id FROM aars_config LIMIT 1').get();
    if (!exists) {
      db.prepare(`INSERT INTO aars_config DEFAULT VALUES`).run();
    }

    // automata_trust — 自适应信任积累
    db.exec(`
      CREATE TABLE IF NOT EXISTS automata_trust (
        operation_key TEXT PRIMARY KEY,
        approval_count INTEGER DEFAULT 0,
        rejection_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0.5,
        last_updated TEXT
      )
    `);

    // probe_execution_stats — 探针执行统计
    db.exec(`
      CREATE TABLE IF NOT EXISTS probe_execution_stats (
        probe_id TEXT PRIMARY KEY,
        total_uses INTEGER DEFAULT 0,
        successful_diagnoses INTEGER DEFAULT 0,
        total_duration_ms INTEGER DEFAULT 0,
        last_used_at TEXT,
        device_id TEXT,
        alert_type TEXT
      )
    `);
  },
  async down(db) {
    db.exec(`DROP TABLE IF EXISTS aars_response_logs`);
    db.exec(`DROP TABLE IF EXISTS aars_config`);
    db.exec(`DROP TABLE IF EXISTS automata_trust`);
    db.exec(`DROP TABLE IF EXISTS probe_execution_stats`);
  },
};

export default migration;
