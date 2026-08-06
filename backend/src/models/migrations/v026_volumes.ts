import type { Database } from 'better-sqlite3';

export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS storage_volumes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      driver TEXT DEFAULT 'local',
      mount_point TEXT DEFAULT '',
      size_gb INTEGER DEFAULT 0,
      used_gb INTEGER DEFAULT 0,
      status TEXT DEFAULT 'available',
      host TEXT DEFAULT '',
      type TEXT DEFAULT 'docker',
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
}

export function down(db: Database) {
  db.exec(`DROP TABLE IF EXISTS storage_volumes;`);
}

const v025_volumes = { up, down };
export default v025_volumes;
