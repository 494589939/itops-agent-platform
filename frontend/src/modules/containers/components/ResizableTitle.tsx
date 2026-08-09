import { useRef } from 'react';

/**
 * 可拖拽表头 cell（零依赖）：鼠标拖动表头右侧手柄调整列宽。
 * 用法：
 *   <Table components={{ header: { cell: ResizableTitle } }} ... />
 *   列定义需提供 width 与 onHeaderCell（返回 { width, onWidthChange }）。
 */
interface ResizableTitleProps extends React.HTMLAttributes<HTMLTableCellElement> {
  width?: number;
  onWidthChange?: (width: number) => void;
}

export default function ResizableTitle({ width, onWidthChange, children, ...restProps }: ResizableTitleProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const draggingRef = useRef(false);

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
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <th {...restProps} style={{ position: 'relative', ...restProps.style }}>
      {children}
      <span
        onMouseDown={onDragStart}
        title="拖动调整列宽"
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 6, cursor: 'col-resize', userSelect: 'none', touchAction: 'none',
          zIndex: 1,
        }}
      />
    </th>
  );
}
