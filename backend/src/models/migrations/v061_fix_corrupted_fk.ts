/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

/**
 * Migration v061 — Fix corrupted FK references from v058
 *
 * v058 重建 dc_racks 时，先重建了 dc_rack_slots（FK 引用 dc_racks），
 * 然后将 dc_racks 重命名为 _dc_racks_backup，导致 dc_rack_slots 的 FK
 * 被 SQLite 自动"污染"指向 _dc_racks_backup（已不存在的表）。
 *
 * 本迁移修复：
 *   1) dc_rack_slots 的 FK 从 _dc_racks_backup 改回 dc_racks
 *   2) dc_pdus 的 FK 从 _dc_racks_backup 改回 dc_racks
 *   3) dc_power_feeds 的 FK 从 _dc_racks_backup 改回 dc_racks
 *   4) 4 个 DELETE trigger 的目标表从 _dc_rack_slots_backup 改回 dc_rack_slots
 */
const v061FixCorruptedFk: Migration = {
  id: '20250101000061',
  version: 61,
  name: 'fix_corrupted_fk',
  description: 'Fix corrupted FK references from v058 (dc_rack_slots, dc_pdus, dc_power_feeds, triggers)',

  up: async (db: any) => {
    logger.info('🔧 Fixing corrupted FK references from v058...');

    // 1) Fix dc_rack_slots FK
    const slotsSchema = (db.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='dc_rack_slots'
    `).get() as { sql: string } | undefined)?.sql || '';
    if (slotsSchema.includes('_dc_racks_backup')) {
      logger.info('  → Fixing dc_rack_slots FK (references _dc_racks_backup)');
      db.exec(`
        ALTER TABLE dc_rack_slots RENAME TO _dc_rack_slots_fix_backup;

        CREATE TABLE dc_rack_slots (
          id TEXT PRIMARY KEY,
          rack_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          device_type TEXT NOT NULL CHECK(device_type IN ('server','network_device','vm_host','pdu','ups','other')),
          device_type_id TEXT,
          start_u INTEGER NOT NULL,
          end_u INTEGER NOT NULL,
          position_face TEXT DEFAULT 'front',
          notes TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (rack_id) REFERENCES dc_racks(id) ON DELETE CASCADE,
          FOREIGN KEY (device_type_id) REFERENCES device_types(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_dc_rack_slots_rack ON dc_rack_slots(rack_id);
        CREATE INDEX IF NOT EXISTS idx_dc_rack_slots_device ON dc_rack_slots(device_id);

        INSERT INTO dc_rack_slots (id, rack_id, device_id, device_type, device_type_id, start_u, end_u, position_face, notes, created_at, updated_at)
        SELECT id, rack_id, device_id, device_type, device_type_id, start_u, end_u, position_face, notes, created_at, updated_at
        FROM _dc_rack_slots_fix_backup;
        DROP TABLE _dc_rack_slots_fix_backup;
      `);
    } else {
      logger.info('  ✓ dc_rack_slots FK OK');
    }

    // 2) Fix dc_pdus FK
    const pdusSchema = (db.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='dc_pdus'
    `).get() as { sql: string } | undefined)?.sql || '';
    if (pdusSchema.includes('_dc_racks_backup')) {
      logger.info('  → Fixing dc_pdus FK (references _dc_racks_backup)');
      db.exec(`
        ALTER TABLE dc_pdus RENAME TO _dc_pdus_fix_backup;

        CREATE TABLE dc_pdus (
          id TEXT PRIMARY KEY,
          name TEXT,
          type TEXT CHECK(type IN ('pdu', 'ups')),
          status TEXT CHECK(status IN ('active', 'inactive', 'fault', 'maintenance')),
          rack_id TEXT,
          power_capacity_w REAL,
          current_load_w REAL,
          input_voltage REAL,
          output_sockets INTEGER,
          model TEXT,
          ip_address TEXT,
          snmp_community TEXT,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (rack_id) REFERENCES dc_racks(id) ON DELETE SET NULL
        );

        INSERT INTO dc_pdus (id, name, type, status, rack_id, power_capacity_w, current_load_w, input_voltage, output_sockets, model, ip_address, snmp_community, notes, created_at, updated_at)
        SELECT id, name, type, status, rack_id, power_capacity_w, current_load_w, input_voltage, output_sockets, model, ip_address, snmp_community, notes, created_at, updated_at
        FROM _dc_pdus_fix_backup;
        DROP TABLE _dc_pdus_fix_backup;
      `);
    } else {
      logger.info('  ✓ dc_pdus FK OK');
    }

    // 3) Fix dc_power_feeds FK
    const feedsSchema = (db.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='dc_power_feeds'
    `).get() as { sql: string } | undefined)?.sql || '';
    if (feedsSchema.includes('_dc_racks_backup')) {
      logger.info('  → Fixing dc_power_feeds FK (references _dc_racks_backup)');
      const cols = db.prepare("PRAGMA table_info('dc_power_feeds')").all() as Array<{ name: string; type: string; pk: number; notnull: number }>;
      const colDefs = cols.map(c => {
        let def = `${c.name} ${c.type || 'TEXT'}`;
        if (c.pk) def += ' PRIMARY KEY';
        if (c.notnull) def += ' NOT NULL';
        return def;
      }).join(', ');
      const colNames = cols.map(c => c.name).join(', ');

      db.exec(`
        ALTER TABLE dc_power_feeds RENAME TO _dc_power_feeds_fix_backup;
        CREATE TABLE dc_power_feeds (${colDefs.replace(/_dc_racks_backup/g, 'dc_racks')});
        INSERT INTO dc_power_feeds (${colNames}) SELECT ${colNames} FROM _dc_power_feeds_fix_backup;
        DROP TABLE _dc_power_feeds_fix_backup;
      `);
    } else {
      logger.info('  ✓ dc_power_feeds FK OK');
    }

    // 4) Fix triggers that reference _dc_rack_slots_backup
    const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger' AND sql LIKE '%_dc_rack_slots_backup%'").all();
    if (triggers.length > 0) {
      logger.info(`  → Fixing ${triggers.length} trigger(s) referencing _dc_rack_slots_backup`);
      for (const t of triggers) {
        const fixedSql = (t.sql as string).replace(/_dc_rack_slots_backup/g, 'dc_rack_slots');
        db.exec(`DROP TRIGGER IF EXISTS ${t.name}`);
        db.exec(fixedSql);
        logger.info(`    ✓ ${t.name}`);
      }
    } else {
      logger.info('  ✓ No corrupted triggers');
    }

    logger.info('✅ Corrupted FK references fixed');
  },

  down: async (_db: any) => {
    logger.warn('v061 down: cannot revert FK fix, manual intervention required');
  },
};

export default v061FixCorruptedFk;
