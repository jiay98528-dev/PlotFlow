import type { ChangeEvent, ReactNode } from 'react';

interface TweaksPanelProps {
  theme: 'light' | 'dark';
  density: 'compact' | 'comfortable';
  milestoneFocus: string;
  discrepancyOnly: boolean;
  milestoneOptions: Array<{ value: string; label: string }>;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onDensityChange: (density: 'compact' | 'comfortable') => void;
  onMilestoneChange: (value: string) => void;
  onDiscrepancyOnlyChange: (value: boolean) => void;
}

export function TweaksPanel({
  theme,
  density,
  milestoneFocus,
  discrepancyOnly,
  milestoneOptions,
  onThemeChange,
  onDensityChange,
  onMilestoneChange,
  onDiscrepancyOnlyChange,
}: TweaksPanelProps): ReactNode {
  const handleMilestoneChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onMilestoneChange(event.target.value);
  };

  return (
    <aside className="tweaks-panel">
      <header className="tweaks-panel__header">
        <span className="tweaks-panel__eyebrow">Tweaks</span>
        <h2 className="tweaks-panel__title">视图参数</h2>
      </header>

      <label className="tweaks-field">
        <span>Theme</span>
        <div className="segmented">
          <button
            type="button"
            className={theme === 'light' ? 'segmented__button is-active' : 'segmented__button'}
            onClick={() => onThemeChange('light')}
          >
            Light
          </button>
          <button
            type="button"
            className={theme === 'dark' ? 'segmented__button is-active' : 'segmented__button'}
            onClick={() => onThemeChange('dark')}
          >
            Dark
          </button>
        </div>
      </label>

      <label className="tweaks-field">
        <span>Density</span>
        <div className="segmented">
          <button
            type="button"
            className={density === 'compact' ? 'segmented__button is-active' : 'segmented__button'}
            onClick={() => onDensityChange('compact')}
          >
            Compact
          </button>
          <button
            type="button"
            className={density === 'comfortable' ? 'segmented__button is-active' : 'segmented__button'}
            onClick={() => onDensityChange('comfortable')}
          >
            Comfortable
          </button>
        </div>
      </label>

      <label className="tweaks-field">
        <span>Milestone Focus</span>
        <select value={milestoneFocus} onChange={handleMilestoneChange}>
          {milestoneOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="tweaks-switch">
        <input
          type="checkbox"
          checked={discrepancyOnly}
          onChange={(event) => onDiscrepancyOnlyChange(event.target.checked)}
        />
        <span>只高亮存在 discrepancy 的项目</span>
      </label>
    </aside>
  );
}
