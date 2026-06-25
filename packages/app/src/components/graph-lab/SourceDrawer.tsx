import React from 'react';
import { FileCode2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

interface SourceDrawerProps {
  readonly children: React.ReactNode;
}

export function SourceDrawer({ children }: SourceDrawerProps): React.ReactElement {
  const isOpen = useUIStore((state) => state.isSourceDrawerOpen);

  return (
    <section
      className={`source-drawer${isOpen ? ' source-drawer--open' : ''}`}
      aria-label="Graph Lab Source Dock"
      data-testid="graph-lab-source-drawer"
    >
      <header className="source-drawer__header">
        <span>
          <FileCode2 aria-hidden="true" size={15} strokeWidth={2} />
          源文本 Dock
        </span>
        <small>{isOpen ? 'GUI 操作会同步写回 .mdstory' : '从顶部按钮展开源文本'}</small>
      </header>
      <div className="source-drawer__body" aria-hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}
