import type { Database } from 'better-sqlite3';

export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS container_images (
      id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL,
      name TEXT NOT NULL,
      tag TEXT DEFAULT 'latest',
      size_bytes INTEGER DEFAULT 0,
      host TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
}

export function down(db: Database) {
  db.exec(`DROP TABLE IF EXISTS container_images;`);
}

const v024_container_images = { up, down };
export default v024_container_images;
