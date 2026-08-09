import { useRef, useState } from 'react';

/**
 * 可拖拽表头 cell（零依赖）：鼠标拖动表头右侧手柄调整列宽。
 * 用法：
 *   <Table components={{ header: { cell: ResizableTitle } }} ... />
 *   列定义需提供 width 与 onHeaderCell（返回 { width, onWidthChange, onReset? }）。
 */
interface ResizableTitleProps extends React.HTMLAttributes<HTMLTableCellElement> {
  width?: number;
  onWidthChange?: (width: number) => void;
  /** 双击手柄重置为该默认宽度 */
  onReset?: () => void;
}

export default function ResizableTitle({ width, onWidthChange, onReset, children, ...restProps }: ResizableTitleProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const draggingRef = useRef(false);
  const [hover, setHover] = useState(false);

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width || 100;

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = Math.max(60, startWidthRef.current + (ev.clientX - startXRef.current));
      onWidthChange?.(Math.round(next));
    };
    const onUp = () => {
      draggingRef.current = false;
      setHover(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <th {...restProps} style={{ position: 'relative', ...restProps.style }}>
      {children}
      {/* 拖拽手柄：骑在列右边缘（含相邻列分隔线区域），悬停高亮提示可拖 */}
      <span
        onMouseDown={onDragStart}
        onDoubleClick={(e) => { e.stopPropagation(); onReset?.(); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="拖动调整列宽（双击恢复默认）"
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 14,
          cursor: 'col-resize',
          userSelect: 'none',
          touchAction: 'none',
          zIndex: 30,
          background: hover ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
        }}
      />
    </th>
  );
}
