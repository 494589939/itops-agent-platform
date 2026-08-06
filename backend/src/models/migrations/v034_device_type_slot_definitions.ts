import type { Database } from 'better-sqlite3';

/**
 * v033_device_type_slot_definitions.ts
 * 设备型号槽位定义表 — 参考 NetBox dcim.{PowerPort,Interface,ConsolePort,...}Template
 * 定义每种型号默认有哪些端口/槽位，创建设备实例时自动填充到 dc_rack_slots
 */
export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_type_slot_definitions (
      id TEXT PRIMARY KEY,
      device_type_id TEXT NOT NULL,
      slot_type TEXT NOT NULL CHECK(slot_type IN (
        'power_port','interface','console_port','console_server_port',
        'power_outlet','module_bay','device_bay','front_port','rear_port','pdu_outlet'
      )),
      slot_name TEXT NOT NULL,
      slot_label TEXT DEFAULT '',
      position_label TEXT DEFAULT '',
      u_position INTEGER DEFAULT 0,
      is_preferred INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (device_type_id) REFERENCES device_types(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_slot_defs_type ON device_type_slot_definitions(device_type_id);

    -- PowerEdge R750 预置槽位
    INSERT OR IGNORE INTO device_type_slot_definitions
      (id, device_type_id, slot_type, slot_name, slot_label, position_label)
    VALUES
      -- 电源口 × 2
      ('slot-de-r750-psu1', 'dt-dell-r750', 'power_port', 'PSU1', 'Power Supply 1', 'Rear Left'),
      ('slot-de-r750-psu2', 'dt-dell-r750', 'power_port', 'PSU2', 'Power Supply 2', 'Rear Right'),
      -- 网口
      ('slot-de-r750-mgmt', 'dt-dell-r750', 'interface', 'iDRAC', 'iDRAC9 Dedicated', 'Rear'),
      ('slot-de-r750-eth0', 'dt-dell-r750', 'interface', 'GigE 0/0/0', '1GbE RJ45', 'Rear'),
      ('slot-de-r750-eth1', 'dt-dell-r750', 'interface', 'GigE 0/0/1', '1GbE RJ45', 'Rear'),
      ('slot-de-r750-eth2', 'dt-dell-r750', 'interface', 'GigE 0/0/2', '1GbE RJ45', 'Rear'),
      ('slot-de-r750-eth3', 'dt-dell-r750', 'interface', 'GigE 0/0/3', '1GbE RJ45', 'Rear'),
      -- 设备Bay（可选GPU等）
      ('slot-de-r750-bay1', 'dt-dell-r750', 'device_bay', 'Bay 1', 'Half-length FH', 'Internal');

    -- 华为 2288H 预置槽位
    INSERT OR IGNORE INTO device_type_slot_definitions
      (id, device_type_id, slot_type, slot_name, slot_label, position_label)
    VALUES
      ('slot-hw-2288h-psu1', 'dt-huawei-2288h', 'power_port', 'PSU1', 'Power Supply Module 1', 'Rear'),
      ('slot-hw-2288h-psu2', 'dt-huawei-2288h', 'power_port', 'PSU2', 'Power Supply Module 2', 'Rear'),
      ('slot-hw-2288h-bmc', 'dt-huawei-2288h', 'interface', 'BMC', 'BMC Management', 'Rear'),
      ('slot-hw-2288h-eth0', 'dt-huawei-2288h', 'interface', 'GE0/0/0', '10GbE SFP+', 'Rear'),
      ('slot-hw-2288h-eth1', 'dt-huawei-2288h', 'interface', 'GE0/0/1', '10GbE SFP+', 'Rear'),
      ('slot-hw-2288h-eth2', 'dt-huawei-2288h', 'interface', 'GE0/0/2', '25GbE SFP28', 'Rear'),
      ('slot-hw-2288h-eth3', 'dt-huawei-2288h', 'interface', 'GE0/0/3', '25GbE SFP28', 'Rear');

    -- Catalyst 9300 预置槽位
    INSERT OR IGNORE INTO device_type_slot_definitions
      (id, device_type_id, slot_type, slot_name, slot_label, position_label)
    VALUES
      ('slot-c9300-psu', 'dt-cisco-c9300', 'power_port', 'PSU', 'AC Power Supply', 'Rear'),
      ('slot-c9300-console', 'dt-cisco-c9300', 'console_port', 'Console', 'RJ45 Console', 'Front'),
      ('slot-c9300-usb', 'dt-cisco-c9300', 'console_port', 'USB Console', 'USB Mini-B', 'Front'),
      ('slot-c9300-gi1', 'dt-cisco-c9300', 'interface', 'GigE 1/0/1', '1GbE RJ45', 'Front'),
      ('slot-c9300-gi48', 'dt-cisco-c9300', 'interface', 'GigE 1/0/48', '1GbE RJ45', 'Front');
  `);
}

export function down(db: Database) {
  db.exec('DROP TABLE IF EXISTS device_type_slot_definitions');
}
