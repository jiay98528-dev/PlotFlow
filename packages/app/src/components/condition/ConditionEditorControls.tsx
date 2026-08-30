import React, { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ComparisonOperator,
  LogicalOperator,
  VariableDeclaration,
  VariableType,
} from '@plotflow/core';
import { useAppText } from '../../i18n/appI18n';
import {
  chevronStyle,
  disabledInputStyle,
  dropdownButtonStyle,
  dropdownContainerStyle,
  dropdownItemActiveStyle,
  dropdownItemStyle,
  dropdownListStyle,
  dropdownMenuStyle,
  emptyOptionStyle,
  noVarsHintStyle,
  numberInputStyle,
  placeholderStyle,
  searchContainerStyle,
  searchInputStyle,
  selectStyle,
  textInputStyle,
  typeIconStyle,
  typeLabelStyle,
} from './conditionEditorStyles';

// ============================================================================
// 常量
// ============================================================================

/** 变量类型 → 图标映射 */
const VARIABLE_TYPE_ICONS: Readonly<Record<VariableType, string>> = {
  int: '#',
  float: '0.0',
  bool: '✓',
  string: '“',
  enum: '[]',
  object: '{}',
};

/** 比较运算符 → 中文标签 */
const OPERATOR_LABELS: Readonly<Record<ComparisonOperator, string>> = {
  '==': '＝',
  '!=': '≠',
  '>': '＞',
  '<': '＜',
  '>=': '≥',
  '<=': '≤',
};

/** 逻辑运算符颜色映射 */
export const LOGIC_GROUP_COLORS: Readonly<Record<LogicalOperator, string>> = {
  AND: 'var(--color-syntax-heading)',
  OR: 'var(--color-syntax-condition)',
  NOT: 'var(--color-status-warning)',
};

// ============================================================================
// 辅助函数：运算符过滤
// ============================================================================

/**
 * 根据变量类型获取可用的比较运算符。
 *
 * - int/float: == != > < >= <=
 * - bool/string/enum: == !=
 * - object: 不可比较（返回空数组）
 */
export function getOperatorsForType(type: VariableType | null): ComparisonOperator[] {
  if (!type) return ['==', '!=', '>', '<', '>=', '<='];
  switch (type) {
    case 'int':
    case 'float':
      return ['==', '!=', '>', '<', '>=', '<='];
    case 'bool':
    case 'string':
    case 'enum':
      return ['==', '!='];
    case 'object':
      return [];
    default:
      return ['==', '!='];
  }
}

export function findVariableDeclaration(
  name: string,
  variables: readonly VariableDeclaration[],
): VariableDeclaration | null {
  const segments = name.split('.');
  let current = variables.find((variable) => variable.name === segments[0]);

  for (const segment of segments.slice(1)) {
    current = current?.fields?.find((field) => field.name === segment);
  }

  return current ?? null;
}

interface VariableOption {
  readonly name: string;
  readonly declaration: VariableDeclaration;
}

/** 将 object 字段展开为条件表达式可引用的点路径。 */
function flattenVariableOptions(
  variables: readonly VariableDeclaration[],
  prefix = '',
): VariableOption[] {
  return variables.flatMap((variable) => {
    const name = prefix ? `${prefix}.${variable.name}` : variable.name;
    const current = variable.type === 'object' ? [] : [{ name, declaration: variable }];
    const children = variable.fields ? flattenVariableOptions(variable.fields, name) : [];
    return [...current, ...children];
  });
}

// ============================================================================
// Portal 下拉基础设施
// ============================================================================

interface DropdownPosition {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly maxHeight: number;
  readonly opensUpward: boolean;
}

interface AnchoredDropdownOptions {
  readonly isOpen: boolean;
  readonly onDismiss: () => void;
}

const DROPDOWN_VIEWPORT_GUTTER = 8;
const DROPDOWN_OFFSET = 4;
const DROPDOWN_MAX_HEIGHT = 220;
const DROPDOWN_MIN_HEIGHT = 48;

/**
 * 模态编辑器提供 body 直系的专属浮层宿主，并通过 aria-owns 与焦点陷阱
 * 合并其可访问性边界；Graph Inspector 等内联场景则继续回退到 body。
 */
export const DropdownPortalHostContext = React.createContext<HTMLElement | null>(null);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 将条件编辑器下拉菜单挂到 body，避免 Inspector 与条件树的 overflow 裁切。
 * 所有关闭事件和位置观察都在菜单关闭时清理，避免长时间编辑时遗留监听器。
 */
function useAnchoredDropdown({ isOpen, onDismiss }: AnchoredDropdownOptions): {
  readonly triggerRef: React.RefObject<HTMLButtonElement>;
  readonly menuRef: React.RefObject<HTMLDivElement>;
  readonly position: DropdownPosition | null;
} {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const maxWidth = Math.max(0, viewportWidth - DROPDOWN_VIEWPORT_GUTTER * 2);
    const width = Math.min(Math.max(triggerRect.width, menuRect.width), maxWidth);
    const availableBelow =
      viewportHeight - triggerRect.bottom - DROPDOWN_OFFSET - DROPDOWN_VIEWPORT_GUTTER;
    const availableAbove = triggerRect.top - DROPDOWN_OFFSET - DROPDOWN_VIEWPORT_GUTTER;
    const measuredHeight = Math.min(
      Math.max(menuRect.height, DROPDOWN_MIN_HEIGHT),
      DROPDOWN_MAX_HEIGHT,
    );
    const opensUpward = availableBelow < measuredHeight && availableAbove > availableBelow;
    const availableHeight = opensUpward ? availableAbove : availableBelow;
    const maxHeight = Math.max(DROPDOWN_MIN_HEIGHT, Math.min(DROPDOWN_MAX_HEIGHT, availableHeight));
    const renderedHeight = Math.min(measuredHeight, maxHeight);
    const top = opensUpward
      ? Math.max(DROPDOWN_VIEWPORT_GUTTER, triggerRect.top - DROPDOWN_OFFSET - renderedHeight)
      : Math.min(
          viewportHeight - DROPDOWN_VIEWPORT_GUTTER - renderedHeight,
          triggerRect.bottom + DROPDOWN_OFFSET,
        );
    const left = clamp(
      triggerRect.left,
      DROPDOWN_VIEWPORT_GUTTER,
      Math.max(DROPDOWN_VIEWPORT_GUTTER, viewportWidth - DROPDOWN_VIEWPORT_GUTTER - width),
    );

    setPosition({ top, left, width, maxHeight, opensUpward });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    let animationFrame = window.requestAnimationFrame(updatePosition);
    const schedulePositionUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updatePosition);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || menuRef.current?.contains(target))) {
        return;
      }
      onDismiss();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedulePositionUpdate);

    if (triggerRef.current) resizeObserver?.observe(triggerRef.current);
    if (menuRef.current) resizeObserver?.observe(menuRef.current);
    window.addEventListener('resize', schedulePositionUpdate);
    document.addEventListener('scroll', schedulePositionUpdate, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', schedulePositionUpdate);
      document.removeEventListener('scroll', schedulePositionUpdate, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onDismiss, updatePosition]);

  return { triggerRef, menuRef, position };
}

function getDropdownPortalStyle(position: DropdownPosition | null): React.CSSProperties {
  return {
    ...dropdownMenuStyle,
    top: position?.top ?? -10000,
    left: position?.left ?? -10000,
    width: position?.width,
    maxHeight: position?.maxHeight ?? DROPDOWN_MAX_HEIGHT,
    visibility: position ? 'visible' : 'hidden',
    transformOrigin: position?.opensUpward ? 'bottom left' : 'top left',
  };
}

// ============================================================================
// 子组件：变量下拉框 (M3-02)
// ============================================================================

interface VariableDropdownProps {
  readonly variables: readonly VariableDeclaration[];
  readonly selectedName: string;
  readonly onSelect: (name: string) => void;
  readonly ariaLabel: string;
}

export function VariableDropdown({
  variables,
  selectedName,
  onSelect,
  ariaLabel,
}: VariableDropdownProps): React.ReactElement {
  const text = useAppText();
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const didFocusMenuRef = useRef(false);
  const portalHost = useContext(DropdownPortalHostContext);
  const menuId = useId();
  const options = useMemo(() => flattenVariableOptions(variables), [variables]);
  const dismissDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchText('');
    setActiveIndex(-1);
  }, []);
  const { triggerRef, menuRef, position } = useAnchoredDropdown({
    isOpen,
    onDismiss: dismissDropdown,
  });

  useEffect(() => {
    if (!isOpen) {
      didFocusMenuRef.current = false;
      return;
    }
    if (!position || didFocusMenuRef.current) return;
    didFocusMenuRef.current = true;
    inputRef.current?.focus();
  }, [isOpen, position]);

  const filtered = useMemo(() => {
    if (!searchText) return options;
    const lower = searchText.toLowerCase();
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(lower) ||
        text(`conditionEditor.variableType.${option.declaration.type}`).includes(searchText),
    );
  }, [options, searchText, text]);

  const selectedVar = options.find((option) => option.name === selectedName);
  const selectedIcon = selectedVar ? VARIABLE_TYPE_ICONS[selectedVar.declaration.type] : '';
  const activeOptionId = activeIndex >= 0 ? `${menuId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = filtered.findIndex((option) => option.name === selectedName);
    setActiveIndex((current) => {
      if (current >= 0 && current < filtered.length) return current;
      if (selectedIndex >= 0) return selectedIndex;
      return filtered.length > 0 ? 0 : -1;
    });
  }, [filtered, isOpen, selectedName]);

  const chooseActiveOption = useCallback(() => {
    const option = filtered[activeIndex];
    if (!option) return;
    onSelect(option.name);
    dismissDropdown();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [activeIndex, dismissDropdown, filtered, onSelect, triggerRef]);

  const handleListNavigation = useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissDropdown();
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        chooseActiveOption();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (filtered.length === 0) return;
      setActiveIndex((current) => {
        if (event.key === 'Home') return 0;
        if (event.key === 'End') return filtered.length - 1;
        if (event.key === 'ArrowUp') return current <= 0 ? filtered.length - 1 : current - 1;
        return current < 0 || current >= filtered.length - 1 ? 0 : current + 1;
      });
    },
    [chooseActiveOption, dismissDropdown, filtered.length, triggerRef],
  );

  return (
    <div style={dropdownContainerStyle}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-activedescendant={isOpen ? activeOptionId : undefined}
        data-testid="condition-variable-dropdown-trigger"
        data-condition-dropdown="variable"
        style={dropdownButtonStyle}
        onClick={() => {
          if (isOpen) {
            dismissDropdown();
            return;
          }
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const selectedIndex = filtered.findIndex((option) => option.name === selectedName);
          if (event.key === 'Home') setActiveIndex(0);
          else if (event.key === 'End') setActiveIndex(filtered.length - 1);
          else setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
          setIsOpen(true);
        }}
      >
        {selectedVar ? (
          <>
            <span style={typeIconStyle}>{selectedIcon}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedName}
            </span>
            <span style={typeLabelStyle}>
              {text(`conditionEditor.variableType.${selectedVar.declaration.type}`)}
            </span>
          </>
        ) : (
          <span style={placeholderStyle}>{text('conditionEditor.selectVariable')}</span>
        )}
        <span style={chevronStyle}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            data-testid="condition-variable-dropdown-menu"
            data-condition-dropdown="variable"
            style={getDropdownPortalStyle(position)}
          >
            {/* 搜索框 */}
            <div style={searchContainerStyle}>
              <input
                ref={inputRef}
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={text('conditionEditor.searchVariable')}
                aria-label={text('conditionEditor.searchVariable')}
                aria-controls={menuId}
                role="combobox"
                aria-expanded={isOpen}
                aria-autocomplete="list"
                aria-activedescendant={activeOptionId}
                onKeyDown={handleListNavigation}
                style={searchInputStyle}
              />
            </div>

            {/* 变量列表 */}
            <div
              id={menuId}
              role="listbox"
              aria-label={ariaLabel}
              data-testid="condition-variable-dropdown-options"
              style={dropdownListStyle}
            >
              {filtered.length === 0 ? (
                <div style={emptyOptionStyle}>{text('conditionEditor.noMatchingVariable')}</div>
              ) : (
                filtered.map((option, index) => (
                  <button
                    key={option.name}
                    id={`${menuId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={option.name === selectedName}
                    tabIndex={-1}
                    style={{
                      ...dropdownItemStyle,
                      ...(option.name === selectedName || index === activeIndex
                        ? dropdownItemActiveStyle
                        : {}),
                    }}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => {
                      onSelect(option.name);
                      dismissDropdown();
                      window.requestAnimationFrame(() => triggerRef.current?.focus());
                    }}
                  >
                    <span style={typeIconStyle}>
                      {VARIABLE_TYPE_ICONS[option.declaration.type]}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {option.name}
                    </span>
                    <span style={typeLabelStyle}>
                      {text(`conditionEditor.variableType.${option.declaration.type}`)}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* 提示：无变量时 */}
            {variables.length === 0 && (
              <div style={noVarsHintStyle}>{text('conditionEditor.declareVariableFirst')}</div>
            )}
          </div>,
          portalHost ?? document.body,
        )}
    </div>
  );
}

// ============================================================================
// 子组件：运算符下拉框 (M3-03)
// ============================================================================

interface OperatorDropdownProps {
  readonly operators: readonly ComparisonOperator[];
  readonly selected: ComparisonOperator;
  readonly onSelect: (op: ComparisonOperator) => void;
  readonly ariaLabel: string;
}

export function OperatorDropdown({
  operators,
  selected,
  onSelect,
  ariaLabel,
}: OperatorDropdownProps): React.ReactElement {
  const text = useAppText();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, operators.indexOf(selected)));
  const didFocusMenuRef = useRef(false);
  const portalHost = useContext(DropdownPortalHostContext);
  const menuId = useId();
  const dismissDropdown = useCallback(() => setIsOpen(false), []);
  const { triggerRef, menuRef, position } = useAnchoredDropdown({
    isOpen,
    onDismiss: dismissDropdown,
  });

  useEffect(() => {
    if (operators.length === 0 && isOpen) dismissDropdown();
  }, [dismissDropdown, isOpen, operators.length]);

  useEffect(() => {
    if (!isOpen) {
      didFocusMenuRef.current = false;
      return;
    }
    if (!position || didFocusMenuRef.current) return;
    didFocusMenuRef.current = true;
    setActiveIndex(Math.max(0, operators.indexOf(selected)));
    menuRef.current?.focus();
  }, [isOpen, menuRef, operators, position, selected]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(Math.max(0, current), Math.max(0, operators.length - 1)));
  }, [operators.length]);

  const chooseOperator = useCallback(
    (index: number) => {
      const operator = operators[index];
      if (!operator) return;
      onSelect(operator);
      dismissDropdown();
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [dismissDropdown, onSelect, operators, triggerRef],
  );

  const handleOperatorKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissDropdown();
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key === 'Tab') {
        // Keep keyboard focus inside the modal focus domain by returning to
        // the trigger. stopPropagation prevents the dialog-level Tab trap
        // from moving focus past the open dropdown's controls.
        event.preventDefault();
        event.stopPropagation();
        triggerRef.current?.focus();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        chooseOperator(activeIndex);
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      setActiveIndex((current) => {
        if (event.key === 'Home') return 0;
        if (event.key === 'End') return operators.length - 1;
        if (event.key === 'ArrowUp') return current <= 0 ? operators.length - 1 : current - 1;
        return current >= operators.length - 1 ? 0 : current + 1;
      });
    },
    [activeIndex, chooseOperator, dismissDropdown, operators.length, triggerRef],
  );

  if (operators.length === 0) {
    return (
      <div
        style={{ ...dropdownButtonStyle, color: 'var(--color-text-muted)', cursor: 'not-allowed' }}
      >
        {text('conditionEditor.notComparable')}
      </div>
    );
  }

  return (
    <div style={{ ...dropdownContainerStyle, minWidth: 56 }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-activedescendant={isOpen ? `${menuId}-option-${activeIndex}` : undefined}
        data-testid="condition-operator-dropdown-trigger"
        data-condition-dropdown="operator"
        style={dropdownButtonStyle}
        onClick={() => {
          if (isOpen) {
            dismissDropdown();
            return;
          }
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            // Toggle explicitly instead of relying on the synthesized click,
            // which portal focus moves can swallow.
            event.preventDefault();
            if (isOpen) {
              dismissDropdown();
            } else {
              setIsOpen(true);
            }
            return;
          }
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          if (event.key === 'Home') setActiveIndex(0);
          else if (event.key === 'End') setActiveIndex(operators.length - 1);
          else setActiveIndex(Math.max(0, operators.indexOf(selected)));
          setIsOpen(true);
        }}
      >
        <span style={{ fontWeight: 600 }}>{OPERATOR_LABELS[selected] || selected}</span>
        <span style={chevronStyle}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="listbox"
            aria-label={ariaLabel}
            aria-activedescendant={`${menuId}-option-${activeIndex}`}
            tabIndex={-1}
            onKeyDown={handleOperatorKeyDown}
            data-testid="condition-operator-dropdown-menu"
            data-condition-dropdown="operator"
            style={getDropdownPortalStyle(position)}
          >
            {operators.map((op, index) => (
              <button
                key={op}
                id={`${menuId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={op === selected}
                tabIndex={-1}
                style={{
                  ...dropdownItemStyle,
                  ...(op === selected || index === activeIndex ? dropdownItemActiveStyle : {}),
                }}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => {
                  chooseOperator(index);
                }}
              >
                <span style={{ fontWeight: 600 }}>{OPERATOR_LABELS[op]}</span>
                <span style={{ marginLeft: 8, fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  {op}
                </span>
              </button>
            ))}
          </div>,
          portalHost ?? document.body,
        )}
    </div>
  );
}

// ============================================================================
// 子组件：值输入框 (M3-04)
// ============================================================================

interface ValueInputProps {
  readonly variableType: VariableType | null;
  readonly enumValues: readonly string[] | undefined;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly ariaLabel: string;
}

export function ValueInput({
  variableType,
  enumValues,
  value,
  onChange,
  ariaLabel,
}: ValueInputProps): React.ReactElement {
  const text = useAppText();
  // bool → true/false 下拉
  if (variableType === 'bool') {
    return (
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">--</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  // enum → 枚举值下拉
  if (variableType === 'enum' && enumValues && enumValues.length > 0) {
    return (
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">--</option>
        {enumValues.map((ev) => (
          <option key={ev} value={ev}>
            {ev}
          </option>
        ))}
      </select>
    );
  }

  // int → 数字输入
  if (variableType === 'int') {
    return (
      <input
        aria-label={ariaLabel}
        type="number"
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        style={numberInputStyle}
      />
    );
  }

  // float → 数字输入 (step=0.1)
  if (variableType === 'float') {
    return (
      <input
        aria-label={ariaLabel}
        type="number"
        step={0.1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.0"
        style={numberInputStyle}
      />
    );
  }

  // object → 不可编辑
  if (variableType === 'object') {
    return <div style={{ ...disabledInputStyle }}>{text('conditionEditor.notComparable')}</div>;
  }

  // string / 未知 → 文本输入
  return (
    <input
      aria-label={ariaLabel}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={text('conditionEditor.valuePlaceholder')}
      style={textInputStyle}
    />
  );
}

// ============================================================================
// 子组件：单条条件行
// ============================================================================
