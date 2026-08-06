/**
 * =============================================================================
 * Docker 管理服务 - 镜像操作
 * =============================================================================
 */

import type { DockerServiceClass, DockerImage, DockerPullProgress } from './dockerService';
import { logger } from '../../../../utils/logger';

type DS = InstanceType<typeof DockerServiceClass>;

export async function impl_listImages(service: DS): Promise<DockerImage[]> {
  if (!service.initialized) throw new Error('Docker service not available');

  const images = await service.docker.listImages();
  return images.map(normalizeImage);
}

/**
 * 将 dockerode 原始镜像信息（PascalCase）归一化为 DockerImage。
 * listImages 返回顶级 Labels；inspect 返回 Config.Labels —— 统一兼容。
 * 本地 service 与多主机路由共用此映射，保证字段大小写一致。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeImage(img: any): DockerImage {
  const labels = img.Labels ?? img.Config?.Labels ?? undefined;
  return {
    id: img.Id,
    tags: img.RepoTags || [],
    repository: img.RepoTags?.[0]?.split(':')[0] || '<none>',
    tag: img.RepoTags?.[0]?.split(':')[1] || '<none>',
    size: img.Size,
    created: img.Created,
    virtualSize: img.VirtualSize,
    labels,
  };
}

export async function impl_pullImage(service: DS, imageName: string, onProgress?: DockerPullProgress): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  logger.info(`Pulling image: ${imageName}`);
  
  return new Promise((resolve, reject) => {
    service.docker.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) {
        reject(err);
        return;
      }
      
      service.docker.modem.followProgress(stream, (err: Error | null, _output: unknown[]) => {
        if (err) {
          reject(err);
          return;
        }
        logger.info(`Image ${imageName} pulled successfully`);
        resolve();
      }, onProgress);
    });
  });
}

export async function impl_removeImage(service: DS, id: string, force = false, noprune = false): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const image = service.docker.getImage(id);
  await image.remove({ force, noprune });
  logger.info(`Image ${id} removed`);
}

export async function impl_getImageInfo(service: DS, id: string): Promise<DockerImage> {
  if (!service.initialized) throw new Error('Docker service not available');

  const image = service.docker.getImage(id);
  const info = await image.inspect();
  return normalizeImage(info);
}