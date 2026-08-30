import type React from 'react';

// -------- Backdrop --------

export const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 'var(--z-modal)',
  background: 'var(--color-overlay-modal)',
};

// -------- Panel --------

export const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 'calc(var(--z-modal) + 1)',
  width: '640px',
  maxWidth: 'calc(100vw - 48px)',
  maxHeight: 'calc(100vh - 80px)',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--color-bg-primary)',
  borderRadius: 'var(--radius-lg, 8px)',
  boxShadow: 'var(--shadow-xl)',
  border: '1px solid var(--color-border-default)',
  overflow: 'hidden',
};

// -------- Header --------

export const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
  background: 'var(--color-bg-secondary)',
  borderBottom: '1px solid var(--color-border-default)',
  flexShrink: 0,
  userSelect: 'none',
};

export const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-sm, 14px)',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
};

export const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2, 8px)',
};

export const contextBadgeStyle: React.CSSProperties = {
  fontSize: '11px',
  padding: '1px 8px',
  borderRadius: 'var(--radius-full, 9999px)',
  background: 'var(--color-bg-tertiary)',
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
};

export const closeButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '14px',
  color: 'var(--color-text-muted)',
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm, 2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

// -------- Body --------

export const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: 'var(--space-4, 16px)',
};

// -------- Empty Variables State --------

export const emptyVarsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 16px',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-sm, 14px)',
  gap: '4px',
};

export const emptyVarsHintStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-text-muted)',
  marginTop: '4px',
};

// -------- Group --------

export const groupContainerStyle: React.CSSProperties = {
  border: '2px solid',
  borderRadius: 'var(--radius-md, 4px)',
  marginBottom: 'var(--space-3, 12px)',
  overflow: 'hidden',
};

export const groupHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 10px',
  background: 'var(--color-bg-tertiary)',
  borderBottom: '1px solid var(--color-border-default)',
};

export const groupBodyStyle: React.CSSProperties = {
  padding: 'var(--space-2, 8px) var(--space-2, 8px) 0',
};

export const groupActionsStyle: React.CSSProperties = {
  padding: 'var(--space-2, 8px)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2, 8px)',
  flexWrap: 'wrap',
};

// -------- AND/OR Toggle --------

export const operatorToggleStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  borderRadius: 'var(--radius-sm, 2px)',
  overflow: 'hidden',
  border: '1px solid var(--color-border-default)',
};

export const operatorToggleBtnStyle: React.CSSProperties = {
  border: 'none',
  cursor: 'pointer',
  padding: '3px 12px',
  fontSize: '11px',
  fontWeight: 600,
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-secondary)',
  transition: 'background 0.1s ease, color 0.1s ease',
};

export const operatorToggleActiveStyle: React.CSSProperties = {
  color: 'var(--color-text-on-accent)',
};

export const removeGroupButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--color-text-muted)',
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm, 2px)',
  lineHeight: 1,
};

// -------- Condition Row --------

export const conditionRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-2, 8px)',
  marginBottom: 'var(--space-2, 8px)',
};

export const rightOperandStyle: React.CSSProperties = {
  flex: '1 1 180px',
  minWidth: 150,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1, 4px)',
};

export const operandTypeSelectStyle: React.CSSProperties = {
  width: 54,
  flexShrink: 0,
  height: '28px',
  padding: '4px 2px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

export const conditionTreeStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
};

export const conditionTreeCompactStyle: React.CSSProperties = {
  fontSize: '11px',
};

export const clearConditionButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  padding: '4px 2px',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

export const dragHandleStyle: React.CSSProperties = {
  flexShrink: 0,
  color: 'var(--color-text-muted)',
  cursor: 'grab',
  fontSize: '12px',
  padding: '2px',
  userSelect: 'none',
};

export const removeRowButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--color-text-muted)',
  padding: '2px 4px',
  borderRadius: 'var(--radius-sm, 2px)',
  lineHeight: 1,
};

// -------- Dropdown (shared) --------

export const dropdownContainerStyle: React.CSSProperties = {
  position: 'relative',
  minWidth: 120,
  flexShrink: 0,
};

export const dropdownButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  width: '100%',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  cursor: 'pointer',
  textAlign: 'left',
  lineHeight: '20px',
};

export const dropdownMenuStyle: React.CSSProperties = {
  position: 'fixed',
  margin: 0,
  minWidth: 0,
  maxHeight: '220px',
  overflowY: 'auto',
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-md, 4px)',
  boxShadow: 'var(--shadow-md)',
  // Portaled menus must remain above the Condition Editor modal panel while
  // retaining the shared dropdown layer as the semantic baseline.
  zIndex: 'max(var(--z-dropdown), calc(var(--z-modal) + 2))',
};

export const dropdownListStyle: React.CSSProperties = {
  maxHeight: '160px',
  overflowY: 'auto',
};

export const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  width: '100%',
  padding: '5px 10px',
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  cursor: 'pointer',
  textAlign: 'left',
  lineHeight: '18px',
};

export const dropdownItemActiveStyle: React.CSSProperties = {
  background: 'var(--color-accent-subtle)',
};

export const emptyOptionStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '11px',
  color: 'var(--color-text-muted)',
  textAlign: 'center',
};

export const chevronStyle: React.CSSProperties = {
  fontSize: '8px',
  color: 'var(--color-text-muted)',
  marginLeft: 'auto',
  lineHeight: 1,
};

export const placeholderStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  flex: 1,
};

export const typeIconStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 18,
  height: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: 600,
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  color: 'var(--color-accent)',
  background: 'var(--color-accent-subtle)',
  borderRadius: 'var(--radius-sm, 2px)',
};

export const typeLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-text-muted)',
  flexShrink: 0,
};

export const noVarsHintStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '11px',
  color: 'var(--color-text-muted)',
  textAlign: 'center',
  borderTop: '1px solid var(--color-border-default)',
};

// -------- Search --------

export const searchContainerStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--color-border-default)',
};

export const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  outline: 'none',
  boxSizing: 'border-box',
};

// -------- Value Inputs --------

export const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  outline: 'none',
  cursor: 'pointer',
  height: '28px',
  boxSizing: 'border-box',
};

export const numberInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  outline: 'none',
  height: '28px',
  boxSizing: 'border-box',
};

export const textInputStyle: React.CSSProperties = {
  ...numberInputStyle,
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

export const disabledInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-tertiary)',
  color: 'var(--color-text-muted)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
};

// -------- Add Buttons --------

export const addRowButtonStyle: React.CSSProperties = {
  border: '1px dashed var(--color-border-default)',
  background: 'transparent',
  cursor: 'pointer',
  padding: '3px 10px',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  color: 'var(--color-text-secondary)',
  borderRadius: 'var(--radius-sm, 2px)',
  lineHeight: '18px',
};

export const addGroupButtonStyle: React.CSSProperties = {
  border: '1px dashed',
  background: 'transparent',
  cursor: 'pointer',
  padding: '3px 10px',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  fontWeight: 600,
  borderRadius: 'var(--radius-sm, 2px)',
  lineHeight: '18px',
};

export const maxDepthHintStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

// -------- Preview --------

export const previewStyle: React.CSSProperties = {
  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
  borderTop: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-secondary)',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-2, 8px)',
  flexShrink: 0,
};

export const previewLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  flexShrink: 0,
  lineHeight: '20px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

export const previewCodeStyle: React.CSSProperties = {
  flex: 1,
  fontSize: '12px',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  color: 'var(--color-syntax-condition)',
  wordBreak: 'break-all',
  lineHeight: '20px',
};

export const previewPlaceholderStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontStyle: 'italic',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

// -------- Footer --------

export const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-2, 8px)',
  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
  borderTop: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-secondary)',
  flexShrink: 0,
};

export const cancelButtonStyle: React.CSSProperties = {
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  cursor: 'pointer',
  padding: '6px 16px',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  borderRadius: 'var(--radius-md, 4px)',
  lineHeight: '18px',
};

export const applyButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'var(--color-accent)',
  cursor: 'pointer',
  padding: '6px 20px',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  fontWeight: 600,
  color: 'var(--color-text-on-accent)',
  borderRadius: 'var(--radius-md, 4px)',
  lineHeight: '18px',
};

export const applyButtonDisabledStyle: React.CSSProperties = {
  background: 'var(--color-bg-tertiary)',
  color: 'var(--color-text-muted)',
  cursor: 'not-allowed',
};

// -------- Trigger Button (M3-08) --------

export const triggerButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  cursor: 'pointer',
  padding: '1px 6px',
  borderRadius: 'var(--radius-sm, 2px)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  color: 'var(--color-text-muted)',
  lineHeight: '18px',
  transition: 'background 0.1s ease, color 0.1s ease, border-color 0.1s ease',
  userSelect: 'none',
};

export const triggerActiveStyle: React.CSSProperties = {
  color: 'var(--color-syntax-condition)',
  borderColor: 'var(--color-syntax-condition)',
  background: 'var(--color-accent-subtle)',
};

export const triggerLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
};
