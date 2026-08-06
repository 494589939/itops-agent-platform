import type { Database } from 'better-sqlite3';

/**
 * v036_dc_cables.ts
 * 线缆连接表（简化版）— 参考 NetBox dcim.Cable 的设计但大幅简化
 * 记录任意两个设备端口之间的物理连线
 * 用于 3D 场景中的拓扑线渲染和链路状态可视化
 */
export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dc_cables (
      id TEXT PRIMARY KEY,
      name TEXT DEFAULT '',
      cable_type TEXT DEFAULT 'cat6' CHECK(cable_type IN (
        'cat5','cat5e','cat6','cat6a','cat7','cat8',
        'fiber_om1','fiber_om2','fiber_om3','fiber_om4','fiber_os2',
        'coax','power','hdmi','sas','sata','other'
      )),
      cable_color TEXT DEFAULT '',
      length_m REAL DEFAULT NULL,
      status TEXT DEFAULT 'connected' CHECK(status IN ('connected','planned','decommissioned','fault')),
      -- A 端
      a_device_id TEXT NOT NULL,
      a_device_type TEXT NOT NULL CHECK(a_device_type IN ('server','network_device','vm_host','pdu','ups','power_feed','other')),
      a_port_name TEXT DEFAULT '',
      -- B 端
      b_device_id TEXT NOT NULL,
      b_device_type TEXT NOT NULL CHECK(b_device_type IN ('server','network_device','vm_host','pdu','ups','power_feed','other')),
      b_port_name TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_dc_cables_a ON dc_cables(a_device_id, a_device_type);
    CREATE INDEX IF NOT EXISTS idx_dc_cables_b ON dc_cables(b_device_id, b_device_type);
    CREATE INDEX IF NOT EXISTS idx_dc_cables_status ON dc_cables(status);
  `);
}

export function down(db: Database) {
  db.exec('DROP TABLE IF EXISTS dc_cables');
}
