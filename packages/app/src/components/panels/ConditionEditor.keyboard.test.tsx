// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VariableDeclaration } from '@plotflow/core';
import { ConditionTreeEditor } from './ConditionEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const VARIABLES: VariableDeclaration[] = [
  { name: '生命', type: 'int', defaultValue: 0, lineNumber: 1 },
  { name: '魔力', type: 'int', defaultValue: 0, lineNumber: 2 },
  { name: '名字', type: 'string', defaultValue: '', lineNumber: 3 },
];

function key(target: Element, value: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
  );
}

describe('ConditionEditor keyboard dropdowns', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    act(() => {
      root.render(
        <div data-condition-editor="true">
          <ConditionTreeEditor value={null} variables={VARIABLES} onChange={() => true} />
        </div>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('supports Arrow/Home/End/Enter and aria-activedescendant in the variable combobox', async () => {
    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-testid="condition-variable-dropdown-trigger"]',
    )!;
    trigger.focus();
    await act(async () => {
      key(trigger, 'ArrowDown');
      await Promise.resolve();
    });

    const combobox = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    expect(combobox).toBe(document.activeElement);
    expect(combobox.getAttribute('aria-activedescendant')).toContain('-option-0');

    act(() => key(combobox, 'End'));
    expect(combobox.getAttribute('aria-activedescendant')).toContain('-option-2');
    act(() => key(combobox, 'Home'));
    expect(combobox.getAttribute('aria-activedescendant')).toContain('-option-0');
    act(() => key(combobox, 'ArrowDown'));
    expect(combobox.getAttribute('aria-activedescendant')).toContain('-option-1');
    act(() => key(combobox, 'Enter'));

    expect(document.querySelector('[data-testid="condition-variable-dropdown-menu"]')).toBeNull();
    expect(trigger.textContent).toContain('魔力');
    expect(trigger.closest('[data-condition-editor]')).not.toBeNull();
  });

  it('supports listbox navigation and Escape focus return for operators', async () => {
    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-testid="condition-operator-dropdown-trigger"]',
    )!;
    await act(async () => {
      key(trigger, 'ArrowDown');
      await Promise.resolve();
    });
    const listbox = document.querySelector<HTMLElement>(
      '[data-testid="condition-operator-dropdown-menu"]',
    )!;
    expect(listbox).toBe(document.activeElement);
    expect(listbox.getAttribute('aria-activedescendant')).toContain('-option-0');

    act(() => key(listbox, 'End'));
    expect(listbox.getAttribute('aria-activedescendant')).toContain('-option-5');
    act(() => key(listbox, 'Home'));
    expect(listbox.getAttribute('aria-activedescendant')).toContain('-option-0');
    act(() => key(listbox, 'Escape'));

    expect(document.querySelector('[data-testid="condition-operator-dropdown-menu"]')).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });
});
