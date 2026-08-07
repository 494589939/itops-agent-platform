import path from 'path';
import { logger } from '../../../../../utils/logger';
import type {
  VirtualMachine,
  CreateVMRequest,
  CloneVMRequest,
} from '../../../../../types/vmManagement';
import type { KvmSshClient } from './sshClient';
import { validateVMId } from './sshClient';
import { parseVirshList, mapVirshStatus, mapVirshPowerState } from './mappers';
import { powerOnVM } from './vmPower';

export async function listVMs(client: KvmSshClient): Promise<VirtualMachine[]> {
  await client.ensureConnected();
  logger.info('📋 获取 KVM 虚拟机列表');

  try {
    const { stdout } = await client.execSSH('virsh list --all');
    const vms = parseVirshList(stdout);

    const result: VirtualMachine[] = [];
    for (const vm of vms) {
      try {
        const detail = await client.getVMDetail(vm.name);
        result.push({
          id: vm.name,
          name: vm.name,
          hypervisorType: 'kvm',
          hypervisorId: client.platformId,
          status: mapVirshStatus(vm.state),
          powerState: mapVirshPowerState(vm.state),
          memoryMB: detail.maxMem ? Math.round(detail.maxMem / 1024) : 0,
          numCPUs: detail.vcpus || 0,
          disks: [],
          networkInterfaces: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        result.push({
          id: vm.name,
          name: vm.name,
          hypervisorType: 'kvm',
          hypervisorId: client.platformId,
          status: mapVirshStatus(vm.state),
          powerState: mapVirshPowerState(vm.state),
          memoryMB: 0,
          numCPUs: 0,
          disks: [],
          networkInterfaces: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return result;
  } catch (error) {
    logger.error('❌ 获取 KVM 虚拟机列表失败:', error);
    throw error;
  }
}

export async function getVM(client: KvmSshClient, vmId: string): Promise<VirtualMachine | null> {
  validateVMId(vmId);
  await client.ensureConnected();
  logger.info(`📋 获取 KVM 虚拟机详情: ${vmId}`);

  try {
    const { stdout: stateOutput } = await client.execSSH(`virsh domstate "${vmId}"`);
    const state = stateOutput.trim().toLowerCase();

    const detail = await client.getVMDetail(vmId);

    return {
      id: vmId,
      name: vmId,
      hypervisorType: 'kvm',
      hypervisorId: client.platformId,
      status: mapVirshStatus(state),
      powerState: mapVirshPowerState(state),
      memoryMB: detail.maxMem ? Math.round(detail.maxMem / 1024) : 0,
      numCPUs: detail.vcpus || 0,
      disks: [],
      networkInterfaces: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`❌ 获取 KVM 虚拟机 ${vmId} 详情失败:`, error);
    return null;
  }
}

export async function createVM(client: KvmSshClient, request: CreateVMRequest): Promise<VirtualMachine> {
  validateVMId(request.name);
  await client.ensureConnected();
  logger.info(`🚀 创建 KVM 虚拟机: ${request.name}`);

  const vcpus = request.config.numCPUs;
  const memory = request.config.memoryMB;
  const diskSize = request.config.disks?.[0]?.sizeGB || 10;
  // path.basename 防止路径遍历
  const safeName = path.basename(request.name);
  const diskPath = `/var/lib/libvirt/images/${safeName}.qcow2`;

  const cmd = [
    'virt-install',
    '--name', safeName,
    '--vcpus', String(vcpus),
    '--memory', String(memory),
    '--disk', `path=${diskPath},size=${diskSize},format=qcow2`,
    '--network', 'network=default',
    '--graphics', 'none',
    '--noautoconsole',
    '--import',
  ];

  if (!request.powerOn) {
    cmd.push('--noautoconsole');
  }

  throw new Error(
    'KVM 虚拟机创建需要预配置的镜像文件。请使用：' +
    cmd.join(' ') +
    ' 或提供自定义 XML 定义文件。建议通过 virsh define 命令从 XML 定义创建虚拟机。'
  );
}

export async function cloneVM(client: KvmSshClient, request: CloneVMRequest): Promise<VirtualMachine> {
  validateVMId(request.vmId);
  validateVMId(request.name);
  await client.ensureConnected();
  logger.info(`📋 克隆 KVM 虚拟机: ${request.vmId} -> ${request.name}`);

  const sourceVM = await getVM(client, request.vmId);
  if (!sourceVM) {
    throw new Error('源虚拟机不存在');
  }

  try {
    const { stdout: xml } = await client.execSSH(`virsh dumpxml "${request.vmId}"`);

    // path.basename 防止路径遍历（如 request.name = "../../etc/cron.d/evil"）
    const safeName = path.basename(request.name);
    const tempFile = `/tmp/${safeName}.xml`;

    // vmId 和 name 已通过白名单校验（仅允许 [a-zA-Z0-9._-]），可安全用于 sed
    // 在 Node.js 中替换 <name> 标签和删除 <uuid> 标签，避免远程 sed 命令注入
    const modifiedXml = xml
      .replace(/<name>[^<]*<\/name>/, `<name>${safeName}</name>`)
      .replace(/<uuid>.*?<\/uuid>/gs, '');

    // 用 base64 编码安全传输 XML 到远程文件（避免 shell 引号转义问题）
    const xmlBase64 = Buffer.from(modifiedXml).toString('base64');
    await client.execSSH(`echo '${xmlBase64}' | base64 -d > ${tempFile}`);

    await client.execSSH(`virsh define ${tempFile}`);
    await client.execSSH(`rm -f ${tempFile}`);

    if (request.powerOn) {
      await powerOnVM(client, safeName);
    }

    return {
      ...sourceVM,
      id: safeName,
      name: safeName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      powerState: request.powerOn ? 'poweredOn' : 'poweredOff',
      status: request.powerOn ? 'running' : 'stopped',
    };
  } catch (error) {
    logger.error('❌ 克隆 KVM 虚拟机失败:', error);
    throw error;
  }
}

export async function deleteVM(client: KvmSshClient, vmId: string): Promise<void> {
  validateVMId(vmId);
  await client.ensureConnected();
  logger.info(`🗑️ 删除 KVM 虚拟机: ${vmId}`);

  try {
    const { stdout: state } = await client.execSSH(`virsh domstate "${vmId}"`);
    if (state.trim().toLowerCase() === 'running') {
      await client.execSSH(`virsh destroy "${vmId}"`);
    }

    await client.execSSH(`virsh undefine --remove-all-storage "${vmId}"`);
    logger.info(`✅ KVM 虚拟机 ${vmId} 已删除`);
  } catch (error) {
    logger.error(`❌ 删除 KVM 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}
