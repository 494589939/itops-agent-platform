import type { Database } from 'better-sqlite3';

export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS virtual_machines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT DEFAULT '',
      status TEXT DEFAULT 'unknown',
      os TEXT DEFAULT '',
      cpu_cores INTEGER DEFAULT 0,
      memory_mb INTEGER DEFAULT 0,
      disk_gb INTEGER DEFAULT 0,
      ip_address TEXT DEFAULT '',
      hypervisor TEXT DEFAULT '',
      agent_id TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
}

export function down(db: Database) {
  db.exec(`DROP TABLE IF EXISTS virtual_machines;`);
}

const v022_virtual_machines = { up, down };
export default v022_virtual_machines;
