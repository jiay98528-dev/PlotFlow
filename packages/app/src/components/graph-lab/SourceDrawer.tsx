import React from 'react';
import { FileCode2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAppText } from '../../i18n/appI18n';

interface SourceDrawerProps {
  readonly children: React.ReactNode;
}

export function SourceDrawer({ children }: SourceDrawerProps): React.ReactElement {
  const isOpen = useUIStore((state) => state.isSourceDrawerOpen);
  const text = useAppText();

  return (
    <section
      className={`source-drawer${isOpen ? ' source-drawer--open' : ''}`}
      aria-label={text('sourceDock.aria')}
      data-testid="graph-lab-source-drawer"
    >
      <header className="source-drawer__header">
        <span>
          <FileCode2 aria-hidden="true" size={15} strokeWidth={2} />
          {text('sourceDock.title')}
        </span>
        <small>{isOpen ? text('sourceDock.openHint') : text('sourceDock.closedHint')}</small>
      </header>
      <div className="source-drawer__body" aria-hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}
