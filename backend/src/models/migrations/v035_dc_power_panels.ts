import type { Database } from 'better-sqlite3';

/**
 * v034_dc_power_panels.ts
 * 配电柜/列头柜表 — 参考 NetBox dcim.PowerPanel
 * 代表机房内的配电单元（RPP/列头柜），一个 PowerPanel 可供应多个 PowerFeed
 */
export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dc_power_panels (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      name TEXT NOT NULL,
      location_label TEXT DEFAULT '',
      panel_type TEXT DEFAULT 'rpp' CHECK(panel_type IN ('rpp','pdu','ups','generator','mains')),
      voltage REAL DEFAULT 220,
      amperage REAL DEFAULT 63,
      phase_count INTEGER DEFAULT 3 CHECK(phase_count IN (1, 3)),
      max_power_kw REAL GENERATED ALWAYS AS (voltage * amperage * phase_count / 1000.0) STORED,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (room_id) REFERENCES dc_rooms(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dc_power_panels_room ON dc_power_panels(room_id);
  `);
}

export function down(db: Database) {
  db.exec('DROP TABLE IF EXISTS dc_power_panels');
}
