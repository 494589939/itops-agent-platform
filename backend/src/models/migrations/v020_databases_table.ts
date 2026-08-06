import type { Database } from 'better-sqlite3';

export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS database_connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'mysql',
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 3306,
      username TEXT NOT NULL DEFAULT '',
      password TEXT DEFAULT '',
      database_name TEXT DEFAULT '',
      ssl_enabled INTEGER DEFAULT 0,
      status TEXT DEFAULT 'disconnected',
      is_template INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
}

export function down(db: Database) {
  db.exec(`DROP TABLE IF EXISTS database_connections;`);
}

const v019_databases_table = { up, down };
export default v019_databases_table;
