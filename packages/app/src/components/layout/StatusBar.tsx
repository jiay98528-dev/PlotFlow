import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useStoryStore } from '../../stores/storyStore';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { useAppText } from '../../i18n/appI18n';

function formatStatusMessage(message: string): string {
  if (message.startsWith('save:')) return message.slice('save:'.length);
  if (message.startsWith('parse:')) return message.slice('parse:'.length);
  return message;
}

function StatusDiagnostic({
  severity,
  count,
  label,
  title,
}: {
  readonly severity: 'error' | 'warning' | 'info';
  readonly count: number;
  readonly label: string;
  readonly title: string;
}): React.ReactElement | null {
  if (count <= 0) return null;
  return (
    <span className="status-bar__diagnostic" data-severity={severity} title={title} aria-label={title}>
      <span className="status-bar__diagnostic-dot" aria-hidden="true" />
      <span>{label}</span>
      <strong>{count}</strong>
    </span>
  );
}

export function StatusBar(): React.ReactElement {
  const isDirty = useEditorStore((s) => s.isDirty);
  const filePath = useEditorStore((s) => s.filePath);
  const cursorPosition = useEditorStore((s) => s.cursorPosition);
  const diagnostics = useEditorStore((s) => s.diagnostics);
  const plotFlowData = useStoryStore((s) => s.plotFlowData);
  const zoomLevel = useGraphStore((s) => s.zoomLevel);
  const statusMessage = useUIStore((s) => s.statusMessage);
  const text = useAppText();

  const nodeCount = plotFlowData?.chapters.reduce(
    (sum, chapter) => sum + chapter.nodes.length,
    0,
  ) ?? 0;
  const optionCount = plotFlowData?.chapters.reduce(
    (sum, chapter) => sum + chapter.nodes.reduce((total, node) => total + node.options.length, 0),
    0,
  ) ?? 0;

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  const infos = diagnostics.filter((diagnostic) => diagnostic.severity === 'info').length;
  const hasDiagnostics = errors > 0 || warnings > 0 || infos > 0;
  const displayPath = filePath
    ? filePath.split(/[/\\]/).slice(-2).join('/')
    : text('statusBar.unsaved');
  const zoomPercent = `${Math.round(zoomLevel * 100)}%`;
  const visibleStatusMessage = statusMessage ? formatStatusMessage(statusMessage) : '';

  return (
    <footer className="status-bar" aria-label={text('statusBar.aria')}>
      <span className="status-bar__section status-bar-file">
        <span
          className="status-bar__save-state"
          data-state={isDirty ? 'dirty' : 'saved'}
          aria-hidden="true"
        />
        <span className="status-bar__path" title={filePath ?? undefined}>
          {displayPath}
        </span>
      </span>

      <span className="status-bar__section status-bar-center">
        <span>{text('statusBar.nodes', { count: nodeCount })}</span>
        <span className="status-bar__separator">/</span>
        <span>{text('statusBar.options', { count: optionCount })}</span>
        <span className="status-bar__separator">|</span>
        {hasDiagnostics ? (
          <>
            <StatusDiagnostic
              severity="error"
              count={errors}
              label="E"
              title={text('statusBar.errorCount', { count: errors })}
            />
            <StatusDiagnostic
              severity="warning"
              count={warnings}
              label="W"
              title={text('statusBar.warningCount', { count: warnings })}
            />
            <StatusDiagnostic
              severity="info"
              count={infos}
              label="I"
              title={text('statusBar.infoCount', { count: infos })}
            />
          </>
        ) : (
          <span className="status-bar__ok" title={text('statusBar.ok')}>
            <CheckCircle2 aria-hidden="true" size={13} strokeWidth={2.1} />
          </span>
        )}
      </span>

      <span className="status-bar__section status-bar-cursor">
        <span>{text('statusBar.lineColumn', { line: cursorPosition.line, column: cursorPosition.column })}</span>
        <span className="status-bar__separator" />
        <span>{zoomPercent}</span>
        {visibleStatusMessage && (
          <span className="status-bar__message" title={visibleStatusMessage}>
            {visibleStatusMessage}
          </span>
        )}
      </span>
    </footer>
  );
}
