/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

/**
 * Migration v062 — dc_rooms 增加环境数据手动标记列
 *
 * 背景：dcRoomEnvironmentService 每 30 秒用模拟随机值覆盖 dc_rooms 的
 * current_temperature / current_humidity / pue / total_power_kw。
 * 数据中心管理 → 机房 现在支持手动填写环境数据：填了就以手动值为准、停止模拟覆盖。
 *
 * 方案：新增 env_manual 列（0=自动模拟，1=手动填写）。
 * 模拟采集服务只更新 env_manual = 0 的机房。
 */
export const migration062: Migration = {
  id: 'v062-dc-room-env-manual',
  version: 62,
  name: 'dc_room_env_manual',
  description: 'dc_rooms 增加 env_manual 列，支持手动填写环境数据并停止模拟覆盖',
  up: async (db: any) => {
    const cols = db.prepare('PRAGMA table_info(dc_rooms)').all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'env_manual')) {
      db.prepare('ALTER TABLE dc_rooms ADD COLUMN env_manual INTEGER NOT NULL DEFAULT 0').run();
      logger.info('✅ [migration v062] dc_rooms.env_manual 列已添加');
    } else {
      logger.info('✅ [migration v062] dc_rooms.env_manual 列已存在，跳过');
    }
  },
  down: async (db: any) => {
    // SQLite 不支持 DROP COLUMN（旧版本），保留列不影响功能
    logger.warn('⚠️ [migration v062] down 未实现（SQLite 不支持 DROP COLUMN，列保留）');
  },
};

export default migration062;
