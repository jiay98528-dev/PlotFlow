import React from 'react';
import { useAppText } from '../../i18n/appI18n';
import type { NodeRouteSummary } from './nodeRouteSummary';

export interface NodeRoutePreviewProps {
  readonly summaries: readonly NodeRouteSummary[];
  readonly variant?: 'default' | 'official';
  readonly maxVisible?: number;
  readonly className?: string;
  readonly renderHandle?: (summary: NodeRouteSummary) => React.ReactNode;
  readonly renderLeadingHandle?: (summary: NodeRouteSummary) => React.ReactNode;
}

export function NodeRoutePreview({
  summaries,
  variant = 'default',
  maxVisible = 3,
  className,
  renderHandle,
  renderLeadingHandle,
}: NodeRoutePreviewProps): React.ReactElement | null {
  const text = useAppText();
  if (summaries.length === 0) return null;

  const visibleRoutes = summaries.slice(0, maxVisible);
  const hiddenRoutes = summaries.slice(visibleRoutes.length);
  const overflowCount = Math.max(0, summaries.length - visibleRoutes.length);
  const classes = [
    'node-route-preview',
    `node-route-preview--${variant}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <ol className={classes} aria-label={text('themeNode.routeSummary')} data-testid="node-route-preview">
      {visibleRoutes.map((summary) => {
        const leadingHandle = renderLeadingHandle?.(summary);
        const isDefaultNext = summary.sourceHandleId === 'next';
        return (
          <li
            key={summary.id}
            className={[
              'node-route-preview__row',
              leadingHandle ? 'node-route-preview--with-input' : '',
              isDefaultNext ? 'node-route-preview--default-next' : '',
              `node-route-preview--route-${summary.kind}`,
              `node-route-preview--target-${summary.targetState}`,
              summary.isConditional ? 'node-route-preview--conditional' : 'node-route-preview--clear',
              summary.hasEffects ? 'node-route-preview--effects' : '',
            ].filter(Boolean).join(' ')}
            data-testid={`node-route-preview-${summary.id}`}
            aria-label={summary.ariaLabel}
            title={summary.ariaLabel}
          >
            {leadingHandle && (
              <span className="node-route-preview__input-slot" aria-hidden="true">
                {leadingHandle}
              </span>
            )}
            <div className="node-route-preview__content">
              <span className="node-route-preview__label">{summary.label}</span>
              <span className="node-route-preview__meta">
                <span
                  className="node-route-preview__chip node-route-preview--requirement"
                  title={summary.requirementTitle}
                >
                  {summary.requirementLabel}
                </span>
                <span
                  className={[
                    'node-route-preview__chip',
                    'node-route-preview--target',
                    `node-route-preview--target-${summary.targetState}`,
                  ].join(' ')}
                  title={summary.targetTitle}
                >
                  {summary.targetLabel}
                </span>
                {summary.effectsLabel && (
                  <span
                    className="node-route-preview__chip node-route-preview--effect"
                    title={summary.effectsTitle ?? summary.effectsLabel}
                  >
                    {summary.effectsLabel}
                  </span>
                )}
              </span>
            </div>
            {renderHandle?.(summary)}
          </li>
        );
      })}
      {overflowCount > 0 && (
        <li className="node-route-preview__row node-route-preview--overflow">
          <span className="node-route-preview__overflow">
            {text('themeNode.moreRoutes', { count: overflowCount })}
          </span>
        </li>
      )}
      {hiddenRoutes.length > 0 && renderHandle && (
        <li className="node-route-preview__row node-route-preview--hidden-handles" aria-hidden="true">
          {hiddenRoutes.map((summary) => (
            <React.Fragment key={`hidden-${summary.id}`}>
              {renderHandle(summary)}
            </React.Fragment>
          ))}
        </li>
      )}
    </ol>
  );
}
