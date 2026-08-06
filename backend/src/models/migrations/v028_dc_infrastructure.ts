import type { Database } from 'better-sqlite3';

/**
 * v027_dc_infrastructure.ts
 * 数据中心基础设施模型 — 物理位置结构化
 * 
 * 层级: DC Room → Row → Rack → Slot → Device
 * 设备管理系统的 device_id → 物理位置的映射
 */
export function up(db: Database) {
  db.exec(`
    -- 1. 机房/数据中心区域
    CREATE TABLE IF NOT EXISTS dc_rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      label TEXT DEFAULT '',           -- 显示标签: "A区"
      description TEXT DEFAULT '',
      width_m REAL DEFAULT 20,         -- 物理宽度(米)
      depth_m REAL DEFAULT 15,         -- 物理进深(米)
      max_temperature REAL DEFAULT 28, -- 温度阈值
      min_temperature REAL DEFAULT 18,
      max_humidity REAL DEFAULT 70,
      min_humidity REAL DEFAULT 30,
      layout_config TEXT DEFAULT '{}',  -- Three.js 场景布局参数 JSON
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 2. 机柜
    CREATE TABLE IF NOT EXISTS dc_racks (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,           -- 所属机房
      name TEXT NOT NULL,              -- "A-01"
      label TEXT DEFAULT '',
      row_number INTEGER DEFAULT 1,   -- 第几排
      position_x REAL DEFAULT 0,      -- Three.js 场景X坐标
      position_z REAL DEFAULT 0,      -- Three.js 场景Z坐标
      total_u INTEGER DEFAULT 42,     -- 总U位数
      pdu_count INTEGER DEFAULT 2,    -- PDU数量
      max_power_w REAL DEFAULT 4000,  -- 最大功耗(W)
      status TEXT DEFAULT 'normal',    -- normal/warning/critical
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 3. 设备-机柜U位映射
    CREATE TABLE IF NOT EXISTS dc_rack_slots (
      id TEXT PRIMARY KEY,
      rack_id TEXT NOT NULL,           -- 所属机柜
      device_id TEXT NOT NULL,         -- 关联 devices.id / servers.id / network_devices.id
      device_type TEXT NOT NULL,       -- 'server' | 'network_device' | 'vm_host' | 'pdu' | 'ups' | 'other'
      start_u INTEGER NOT NULL,        -- 起始U位 (1-based)
      end_u INTEGER NOT NULL,          -- 结束U位
      position_face TEXT DEFAULT 'front', -- front/back
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (rack_id) REFERENCES dc_racks(id) ON DELETE CASCADE
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_dc_racks_room ON dc_racks(room_id);
    CREATE INDEX IF NOT EXISTS idx_dc_rack_slots_rack ON dc_rack_slots(rack_id);
    CREATE INDEX IF NOT EXISTS idx_dc_rack_slots_device ON dc_rack_slots(device_id);
  `);
}

export function down(db: Database) {
  db.exec(`
    DROP TABLE IF EXISTS dc_rack_slots;
    DROP TABLE IF EXISTS dc_racks;
    DROP TABLE IF EXISTS dc_rooms;
  `);
}

const v027_dc_infrastructure = { up, down };
export default v027_dc_infrastructure;
