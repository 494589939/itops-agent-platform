import type { Database } from 'better-sqlite3';

export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_remediations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      alert_id TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      strategy TEXT DEFAULT '',
      result TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
}

export function down(db: Database) {
  db.exec(`DROP TABLE IF EXISTS ai_remediations;`);
}

const v026_ai_remediations = { up, down };
export default v026_ai_remediations;
