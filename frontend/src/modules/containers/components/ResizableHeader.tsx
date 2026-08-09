import { useRef, useState } from 'react';

/**
 * 表头内容（标题 + 拖拽手柄）：渲染在 column.title 内部，不依赖 Table
 * components 替换机制，任何 antd 版本/表格配置下都能正常拖拽。
 * 拖动手柄调整列宽，双击恢复默认宽度。
 */
interface ResizableHeaderProps {
  title: React.ReactNode;
  width: number;
  onWidthChange: (width: number) => void;
  onReset?: () => void;
}

export default function ResizableHeader({ title, width, onWidthChange, onReset }: ResizableHeaderProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const draggingRef = useRef(false);
  const [hover, setHover] = useState(false);

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = Math.max(60, Math.round(startWidthRef.current + (ev.clientX - startXRef.current)));
      onWidthChange(next);
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {title}
      </span>
      <span
        onMouseDown={onDragStart}
        onDoubleClick={(e) => { e.stopPropagation(); onReset?.(); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="拖动调整列宽（双击恢复默认）"
        style={{
          cursor: 'col-resize',
          userSelect: 'none',
          touchAction: 'none',
          marginLeft: 6,
          padding: '0 4px',
          flexShrink: 0,
          color: hover ? '#60a5fa' : 'rgba(128,128,128,0.5)',
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        ↔
      </span>
    </div>
  );
}
