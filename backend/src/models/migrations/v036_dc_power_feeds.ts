import type { Database } from 'better-sqlite3';

/**
 * v035_dc_power_feeds.ts
 * 供电线路表 — 参考 NetBox dcim.PowerFeed
 * 从 PowerPanel 到机柜或设备的具体供电回路
 * 为热力图提供真实的功耗数据源
 */
export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dc_power_feeds (
      id TEXT PRIMARY KEY,
      power_panel_id TEXT NOT NULL,
      rack_id TEXT DEFAULT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','planned','failed','decommissioned')),
      feed_type TEXT DEFAULT 'primary' CHECK(feed_type IN ('primary','redundant')),
      supply TEXT DEFAULT 'ac' CHECK(supply IN ('ac','dc')),
      voltage REAL DEFAULT 220,
      amperage REAL DEFAULT 16,
      max_utilization_pct REAL DEFAULT 80,
      current_load_w REAL DEFAULT 0,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (power_panel_id) REFERENCES dc_power_panels(id) ON DELETE RESTRICT,
      FOREIGN KEY (rack_id) REFERENCES dc_racks(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dc_power_feeds_panel ON dc_power_feeds(power_panel_id);
    CREATE INDEX IF NOT EXISTS idx_dc_power_feeds_rack ON dc_power_feeds(rack_id);

    -- 为每个机房自动创建默认 PowerPanel 和 PowerFeed
    INSERT OR IGNORE INTO dc_power_panels (id, room_id, name, location_label, voltage, amperage)
    SELECT 'pp-default-' || id, id, name || ' - Main RPP', '主配电柜', 220, 63
    FROM dc_rooms;
  `);
}

export function down(db: Database) {
  db.exec('DROP TABLE IF EXISTS dc_power_feeds');
}
