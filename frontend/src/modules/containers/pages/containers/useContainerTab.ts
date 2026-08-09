import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { useToast } from '../../../../contexts/ToastContext';
import type { ContainerItem } from '../types';

/**
 * useContainerTab — 容器 Tab 的状态、查询、变更
 *
 * 较之前 useContainers 的拆分：将"容器"功能独立到一个 hook，
 * 让 useContainers 只是个壳/聚合器，单文件 < 100 行。
 */
export function useContainerTab(endpointId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  const [showStatsDrawer, setShowStatsDrawer] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [selectedContainerName, setSelectedContainerName] = useState('');

  // Create form
  const [createImage, setCreateImage] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPorts, setCreatePorts] = useState('');
  const [createEnv, setCreateEnv] = useState('');
  const [createVolumes, setCreateVolumes] = useState('');
  const [createRestart, setCreateRestart] = useState('no');
  const [createMemory, setCreateMemory] = useState('');
  const [createCpuShares, setCreateCpuShares] = useState('');

  const containersQueryKey = ['containers-list', endpointId, page, pageSize, search, statusFilter];

  const { data: containerData, isLoading: containersLoading, error: containersError } = useQuery({
    queryKey: containersQueryKey,
    queryFn: async () => {
      const { data } = await api.get('/containers', {
        params: {
          page, pageSize, search,
          status: statusFilter || undefined,
          endpointId: endpointId !== 'local' ? endpointId : undefined,
        },
      });
      // API 可能返回数组或 { items: [...], total: N } 对象，统一提取为数组
      const payload = data?.data ?? data;
      const items = Array.isArray(payload) ? payload : (payload?.items ?? []);
      return { data: items as ContainerItem[], total: (data?.total ?? payload?.total ?? items.length) as number };
    },
  });

  const ep = { endpointId: endpointId !== 'local' ? endpointId : undefined };

  const containerActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/containers/${id}/${action}`, null, { params: ep }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: containersQueryKey });
      toast.success(`容器已${vars.action === 'start' ? '启动' : vars.action === 'stop' ? '停止' : '重启'}`);
    },
    onError: () => toast.error('操作失败'),
  });

  const deleteContainerMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/containers/${id}`, { params: ep }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: containersQueryKey });
      toast.success('容器已删除');
    },
    onError: () => toast.error('删除失败'),
  });

  const createContainerMutation = useMutation({
    mutationFn: () =>
      api.post('/containers/run', {
        image: createImage,
        name: createName || undefined,
        ports: createPorts ? createPorts.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        env: createEnv ? createEnv.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        volumes: createVolumes ? createVolumes.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        restartPolicy: createRestart,
        memory: createMemory ? parseInt(createMemory) * 1024 * 1024 : undefined,
        cpuShares: createCpuShares ? parseInt(createCpuShares) : undefined,
      }, { params: ep }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: containersQueryKey });
      toast.success('容器已创建');
      setShowCreateModal(false);
      resetCreateForm();
    },
    onError: () => toast.error('创建容器失败'),
  });

  function resetCreateForm() {
    setCreateImage(''); setCreateName(''); setCreatePorts(''); setCreateEnv('');
    setCreateVolumes(''); setCreateRestart('no'); setCreateMemory(''); setCreateCpuShares('');
  }

  // ── 批量选择与批量操作 ──
  const [selectedContainerIds, setSelectedContainerIds] = useState<Set<string>>(new Set());
  const toggleContainerSelect = (id: string) => {
    setSelectedContainerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllInView = () => {
    setSelectedContainerIds((prev) => {
      const next = new Set(prev);
      (containerData?.data || []).forEach((c) => next.add((c as { id?: string }).id || ''));
      return next;
    });
  };
  const clearContainerSelection = () => setSelectedContainerIds(new Set());
  // 批量操作：逐个执行（容器数不大，逐个请求足够）
  const bulkContainerAction = (action: 'start' | 'stop' | 'restart', ids: string[]) => {
    if (ids.length === 0) return;
    ids.forEach((id) => containerActionMutation.mutate({ id, action }));
    setSelectedContainerIds(new Set());
  };
  const bulkDeleteContainers = (ids: string[]) => {
    if (ids.length === 0) return;
    ids.forEach((id) => deleteContainerMutation.mutate(id));
    setSelectedContainerIds(new Set());
  };

  return {
    // state
    page, setPage, pageSize, setPageSize,
    search, setSearch,
    statusFilter, setStatusFilter,
    showCreateModal, setShowCreateModal,
    showLogsDrawer, setShowLogsDrawer,
    showStatsDrawer, setShowStatsDrawer,
    showDetailDrawer, setShowDetailDrawer,
    selectedContainerId, setSelectedContainerId,
    selectedContainerName, setSelectedContainerName,
    // create form
    createImage, setCreateImage,
    createName, setCreateName,
    createPorts, setCreatePorts,
    createEnv, setCreateEnv,
    createVolumes, setCreateVolumes,
    createRestart, setCreateRestart,
    createMemory, setCreateMemory,
    createCpuShares, setCreateCpuShares,
    // data
    containerData, containersLoading, containersError,
    containersQueryKey,
    // mutations
    containerActionMutation, deleteContainerMutation, createContainerMutation,
    resetCreateForm,
    // 批量选择
    selectedContainerIds, toggleContainerSelect, selectAllInView, clearContainerSelection,
    bulkContainerAction, bulkDeleteContainers,
  };
}
