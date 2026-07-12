import React, { useId, useRef, useState } from 'react';
import { useAppText } from '../../i18n/appI18n';
import { GraphInspector } from './GraphInspector';

type GlobalEditorTab = 'story' | 'variables';

const GLOBAL_EDITOR_TABS: readonly GlobalEditorTab[] = ['story', 'variables'];

/**
 * Story-wide editing belongs in the left rail so node-local work can stay
 * concentrated in the inspector. Keeping this state local prevents a global
 * UI preference from leaking into the story/session model.
 */
export function GraphLabGlobalEditor(): React.ReactElement {
  const text = useAppText();
  const [activeTab, setActiveTab] = useState<GlobalEditorTab>('story');
  const tabId = useId();
  const tabRefs = useRef<Partial<Record<GlobalEditorTab, HTMLButtonElement>>>({});

  const activateTab = (tab: GlobalEditorTab): void => {
    setActiveTab(tab);
    tabRefs.current[tab]?.focus();
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: GlobalEditorTab,
  ): void => {
    const currentIndex = GLOBAL_EDITOR_TABS.indexOf(currentTab);
    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % GLOBAL_EDITOR_TABS.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + GLOBAL_EDITOR_TABS.length) % GLOBAL_EDITOR_TABS.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = GLOBAL_EDITOR_TABS.length - 1;
        break;
      default:
        return;
    }

    const nextTab = GLOBAL_EDITOR_TABS[nextIndex];
    if (!nextTab) return;
    event.preventDefault();
    activateTab(nextTab);
  };

  return (
    <div className="graph-lab-global-editor" data-testid="graph-lab-global-editor">
      <div
        className="graph-lab-global-editor__tabs"
        role="tablist"
        aria-label={text('globalEditor.tabsAria')}
      >
        {GLOBAL_EDITOR_TABS.map((tab) => {
          const isActive = activeTab === tab;
          const id = `${tabId}-${tab}`;
          return (
            <button
              ref={(element) => {
                tabRefs.current[tab] = element ?? undefined;
              }}
              key={tab}
              id={id}
              type="button"
              role="tab"
              className={`graph-lab-global-editor__tab${isActive ? ' is-active' : ''}`}
              data-testid={`graph-global-editor-tab-${tab}`}
              aria-selected={isActive}
              aria-controls={`${id}-panel`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tab)}
            >
              {text(`globalEditor.tabs.${tab}`)}
            </button>
          );
        })}
      </div>

      {GLOBAL_EDITOR_TABS.map((tab) => {
        const isActive = activeTab === tab;
        const id = `${tabId}-${tab}`;
        return (
          <div
            key={tab}
            id={`${id}-panel`}
            className="graph-lab-global-editor__panel"
            role="tabpanel"
            aria-labelledby={id}
            hidden={!isActive}
          >
            {isActive && <GraphInspector contentMode={tab} embedded />}
          </div>
        );
      })}
    </div>
  );
}
