import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { Router } from 'express';
import crypto from 'crypto';

import { getErrorMessage } from '../../../utils/errorHelpers';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * GET /manufacturers — 获取全部制造商列表
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const list = dcCrudService.devices.listManufacturersOrdered();
    res.json({ success: true, data: list });
  } catch (error: unknown) {
    logger.error('Failed to operate dc manufacturers', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
    }
  });

/**
 * GET /manufacturers/:id — 获取单个制造商（含设备型号数量）
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const mfg = dcCrudService.devices.getManufacturerById(req.params.id);
    if (!mfg) return res.status(404).json({ success: false, message: 'Manufacturer not found' });
    const typeCount = dcCrudService.devices.countDeviceTypesByManufacturer(req.params.id);
    res.json({ success: true, data: { ...mfg, device_type_count: typeCount } });
  } catch (error: unknown) {
    logger.error('Failed to operate dc manufacturers', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * 生成 slug：名称转小写连字符；中文/空名时用前缀+随机后缀兜底
 * （制造商/设备型号的 slug 列为 NOT NULL，用户前端不填时后端自动生成）
 */
function autoSlug(text: string, prefix: string): string {
  const base = (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return base || `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * POST /manufacturers — 创建制造商
 */
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, slug, description, logo_url, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name required' });
    const id = crypto.randomUUID();
    dcCrudService.devices.createManufacturer({ id, name, slug: slug || autoSlug(name, 'mfg'), description, logo_url, sort_order });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    logger.error('Failed to operate dc manufacturers', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * PUT /manufacturers/:id — 更新制造商
 */
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, slug, description, logo_url, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name required' });
    dcCrudService.devices.updateManufacturer(req.params.id, { id: req.params.id, name, slug: slug || autoSlug(name, 'mfg'), description, logo_url, sort_order });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to operate dc manufacturers', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * DELETE /manufacturers/:id — 删除制造商（有关联设备型号时禁止删除）
 */
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const typeCount = dcCrudService.devices.countDeviceTypesByManufacturer(req.params.id);
    if (typeCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete manufacturer with ${typeCount} associated device type(s)`
      });
    }
    dcCrudService.devices.deleteManufacturer(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to operate dc manufacturers', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
