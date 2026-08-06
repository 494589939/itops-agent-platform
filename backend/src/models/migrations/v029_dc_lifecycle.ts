import type { Database } from 'better-sqlite3';

/**
 * v028_dc_lifecycle.ts
 * 数据中心设备生命周期 + PDU/UPS 基础设施管理
 */
export function up(db: Database) {
  db.exec(`
    -- 设备上下架生命周期记录
    CREATE TABLE IF NOT EXISTS dc_device_lifecycle (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      device_type TEXT NOT NULL,
      action TEXT NOT NULL,           -- 'mounted' | 'unmounted' | 'moved' | 'maintenance'
      from_rack_id TEXT,
      from_slot_start INTEGER,
      from_slot_end INTEGER,
      to_rack_id TEXT,
      to_slot_start INTEGER,
      to_slot_end INTEGER,
      performed_by TEXT DEFAULT 'system',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- PDU/UPS 设备表
    CREATE TABLE IF NOT EXISTS dc_pdus (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rack_id TEXT,
      type TEXT NOT NULL DEFAULT 'pdu', -- 'pdu' | 'ups' | 'ac' | 'other'
      status TEXT DEFAULT 'normal',
      model TEXT DEFAULT '',
      power_capacity_w REAL DEFAULT 4000,
      current_load_w REAL DEFAULT 0,
      input_voltage REAL DEFAULT 220,
      output_sockets INTEGER DEFAULT 8,
      ip_address TEXT DEFAULT '',
      snmp_community TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (rack_id) REFERENCES dc_racks(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dc_lifecycle_device ON dc_device_lifecycle(device_id);
    CREATE INDEX IF NOT EXISTS idx_dc_lifecycle_rack ON dc_device_lifecycle(to_rack_id);
    CREATE INDEX IF NOT EXISTS idx_dc_pdus_rack ON dc_pdus(rack_id);
  `);
}

export function down(db: Database) {
  db.exec(`
    DROP TABLE IF EXISTS dc_device_lifecycle;
    DROP TABLE IF EXISTS dc_pdus;
  `);
}

const v028_dc_lifecycle = { up, down };
export default v028_dc_lifecycle;
