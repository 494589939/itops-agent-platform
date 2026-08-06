import { logger } from '../../../../utils/logger';
import type { SpecialistBase } from './SpecialistBase';
import type {
  SpecialistDomain,
  SpecialistRegistryEntry
} from './types';

/**
 * Specialist 注册器
 * 管理所有专业领域 Agent
 */
export class SpecialistRegistry {
  private specialists: Map<string, SpecialistBase> = new Map();
  private domainToSpecialists: Map<SpecialistDomain, SpecialistBase[]> = new Map();

  /**
   * 注册一个 Specialist
   */
  register(specialist: SpecialistBase): void {
    if (this.specialists.has(specialist.id)) {
      logger.warn(`Specialist ${specialist.id} (${specialist.name}) 已存在，将被覆盖`);
    }

    this.specialists.set(specialist.id, specialist);

    // 按领域索引
    if (!this.domainToSpecialists.has(specialist.domain)) {
      this.domainToSpecialists.set(specialist.domain, []);
    }
    this.domainToSpecialists.get(specialist.domain)!.push(specialist);

    logger.info(`✅ 已注册 Specialist: ${specialist.name} (${specialist.domain})`);
  }

  /**
   * 批量注册 Specialists
   */
  registerMany(specialists: SpecialistBase[]): void {
    specialists.forEach(s => this.register(s));
  }

  /**
   * 根据 ID 获取 Specialist
   */
  getById(id: string): SpecialistBase | undefined {
    return this.specialists.get(id);
  }

  /**
   * 根据领域获取所有 Specialist
   */
  getByDomain(domain: SpecialistDomain): SpecialistBase[] {
    return this.domainToSpecialists.get(domain) || [];
  }

  /**
   * 获取所有 Specialist
   */
  getAll(): SpecialistBase[] {
    return Array.from(this.specialists.values());
  }

  /**
   * 获取所有启用的 Specialist
   */
  getEnabled(): SpecialistBase[] {
    return this.getAll().filter(s => s.enabled);
  }

  /**
   * 为任务选择最合适的 Specialist
   */
  selectBestSpecialistForTask(taskInput: string): SpecialistBase | null {
    const candidates: { specialist: SpecialistBase; confidence: number }[] = [];

    for (const specialist of this.getEnabled()) {
      const assessment = specialist.canHandleTask(taskInput);
      if (assessment.canHandle) {
        candidates.push({
          specialist,
          confidence: assessment.confidence
        });
      }
    }

    if (candidates.length === 0) {
      logger.warn('没有找到合适的 Specialist 处理此任务');
      return null;
    }

    // 按置信度排序，返回最高的
    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];
    logger.info(`选择 Specialist: ${best.specialist.name}，置信度: ${best.confidence}`);
    return best.specialist;
  }

  /**
   * 获取所有注册信息
   */
  getAllRegistryEntries(): SpecialistRegistryEntry[] {
    return this.getAll().map(s => s.toRegistryEntry());
  }

  /**
   * 取消注册
   */
  unregister(id: string): boolean {
    const specialist = this.specialists.get(id);
    if (!specialist) return false;

    this.specialists.delete(id);

    // 从领域索引中移除
    const domainSpecialists = this.domainToSpecialists.get(specialist.domain);
    if (domainSpecialists) {
      const index = domainSpecialists.findIndex(s => s.id === id);
      if (index !== -1) {
        domainSpecialists.splice(index, 1);
      }
    }

    logger.info(`已取消注册 Specialist: ${specialist.name}`);
    return true;
  }

  /**
   * 清空所有注册
   */
  clear(): void {
    this.specialists.clear();
    this.domainToSpecialists.clear();
    logger.info('已清空所有 Specialist 注册');
  }
}

// 导出单例实例
export const specialistRegistry = new SpecialistRegistry();
