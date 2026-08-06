/**
 * 容器与虚拟化管理模块
 * 
 * 职责：Docker管理、多主机Docker、容器监控/日志、镜像仓库、虚拟机管理(KVM/Proxmox/VMware)
 * 依赖：servers（主机管理）
 */

export { default as routes } from './routes';
