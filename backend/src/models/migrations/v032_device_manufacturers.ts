import type { Database } from 'better-sqlite3';

/**
 * v031_device_manufacturers.ts
 * 设备制造商表 — 参考 NetBox dcim.Manufacturer
 * 存储硬件品牌信息，为设备模板系统提供基础数据
 */
export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_manufacturers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 预置常见厂商
    INSERT OR IGNORE INTO device_manufacturers (id, name, slug, description) VALUES
      ('mfg-dell', 'Dell', 'dell', 'Dell Technologies'),
      ('mfg-hpe', 'HPE', 'hpe', 'Hewlett Packard Enterprise'),
      ('mfg-huawei', 'Huawei', 'huawei', 'Huawei Technologies'),
      ('mfg-cisco', 'Cisco', 'cisco', 'Cisco Systems'),
      ('mfg-h3c', 'H3C', 'h3c', '新华三集团'),
      ('mfg-inspur', 'Inspur', 'inspur', '浪潮信息'),
      ('mfg-sugon', 'Sugon', 'sugon', '中科曙光'),
      ('mfg-lenovo', 'Lenovo', 'lenovo', '联想集团'),
      ('mfg-ibm', 'IBM', 'ibm', 'IBM Corporation'),
      ('mfg-supermicro', 'Supermicro', 'supermicro', 'Super Micro Computer'),
      ('mfg-juniper', 'Juniper', 'juniper', 'Juniper Networks'),
      ('mfg-fortinet', 'Fortinet', 'fortinet', 'Fortinet Inc.'),
      ('mfg-zyxel', 'Zyxel', 'zyxel', 'Zyxel Communications'),
      ('mfg-ruijie', 'Ruijie', 'ruijie', '锐捷网络'),
      ('mfg-maipu', 'Maipu', 'maipu', '迈普通信');
  `);
}

export function down(db: Database) {
  db.exec('DROP TABLE IF EXISTS device_manufacturers');
}
