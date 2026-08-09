import { Tag, Space, Table, Select, Button } from 'antd';
import { Search, Clock as _Clock } from 'lucide-react';
import type useDataCenter from './useDataCenter';
import { actionColors } from './types';
import type { LifecycleRecord } from './types';

type DC = ReturnType<typeof useDataCenter>;

interface Props {
  dc: DC;
}

export default function LifecycleTab({ dc }: Props) {
  const lifecycleColumns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    {
      title: '动作', dataIndex: 'action', key: 'action', render: (v: string) => (
        <Tag color={actionColors[v] || 'default'}>
          {v === 'mounted' ? '上架' : v === 'unmounted' ? '下架' : v === 'moved' ? '迁移' : v === 'maintenance' ? '维护' : v}
        </Tag>
      )
    },
    { title: '设备类型', dataIndex: 'device_type', key: 'device_type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '来源位置', dataIndex: 'from_rack_name', key: 'from_rack_name', render: (_: string, rec: LifecycleRecord) => rec.from_rack_name || rec.from_rack_id || '-' },
    { title: '目标位置', dataIndex: 'to_rack_name', key: 'to_rack_name', render: (_: string, rec: LifecycleRecord) => rec.to_rack_name || rec.to_rack_id || '-' },
    { title: '操作人', dataIndex: 'performed_by', key: 'performed_by' },
    { title: '备注', dataIndex: 'notes', key: 'notes', render: (v: string) => v || '-' },
  ];

  return (
    <div>
      <Space className="mb-4">
        <Select
          placeholder="动作筛选"
          allowClear
          style={{ width: 130 }}
          value={dc.lifecycleFilter || undefined}
          onChange={(v: string) => dc.setLifecycleFilter(v || '')}
        >
          <Select.Option value="mounted">上架</Select.Option>
          <Select.Option value="unmounted">下架</Select.Option>
          <Select.Option value="moved">迁移</Select.Option>
          <Select.Option value="maintenance">维护</Select.Option>
        </Select>
        <Button icon={<Search size={14} />} onClick={dc.loadLifecycles}>刷新</Button>
      </Space>
      <Table columns={lifecycleColumns} dataSource={dc.lifecycles.map((l: LifecycleRecord) => ({ ...l, key: l.id }))}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [50, 100, 200, 500], showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 800 }} loading={dc.lifecyclesLoading} />
    </div>
  );
}