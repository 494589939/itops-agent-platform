import clsx from 'clsx';
import { ChevronDown, ChevronRight, FolderTree, Pencil, Trash2 } from 'lucide-react';
import type { ServerGroup } from './types';

interface GroupTreeProps {
  groups: ServerGroup[];
  level?: number;
  selectedGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
  onEditGroup?: (group: ServerGroup) => void;
  onDeleteGroup?: (group: ServerGroup) => void;
}

export function GroupTree({
  groups,
  level = 0,
  selectedGroupId,
  onSelectGroup,
  onEditGroup,
  onDeleteGroup,
}: GroupTreeProps) {
  return (
    <div className={level > 0 ? 'ml-4' : ''}>
      {groups.map((group) => (
        <div key={group.id}>
          <div
            className={clsx(
              'group flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors text-sm',
              selectedGroupId === group.id
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-background text-text-secondary',
            )}
            onClick={() => onSelectGroup(selectedGroupId === group.id ? null : group.id)}
          >
            {group.children && group.children.length > 0 ? (
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
            )}
            <FolderTree className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate flex-1">{group.name}</span>
            {group.server_count !== undefined && group.server_count > 0 && (
              <span className="text-xs text-text-secondary">({group.server_count})</span>
            )}
            {/* 编辑 / 删除（悬停显示） */}
            {(onEditGroup || onDeleteGroup) && (
              <span
                className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {onEditGroup && (
                  <button
                    onClick={() => onEditGroup(group)}
                    className="p-1 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                    title="编辑分组"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {onDeleteGroup && (
                  <button
                    onClick={() => onDeleteGroup(group)}
                    className="p-1 rounded hover:bg-status-failed/10 text-text-secondary hover:text-status-failed transition-colors"
                    title="删除分组"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </span>
            )}
          </div>
          {group.children && group.children.length > 0 && (
            <GroupTree
              groups={group.children}
              level={level + 1}
              selectedGroupId={selectedGroupId}
              onSelectGroup={onSelectGroup}
              onEditGroup={onEditGroup}
              onDeleteGroup={onDeleteGroup}
            />
          )}
        </div>
      ))}
    </div>
  );
}
