import React, { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAppText } from '../../i18n/appI18n';

export function UXDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  readonly wide?: boolean;
}): React.ReactElement {
  const text = useAppText();
  const id = useId();
  const overlay = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const background = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== overlay.current,
    );
    const previous = background.map((element) => element.inert);
    background.forEach((element) => {
      element.inert = true;
    });
    const dialog = panel.current;
    dialog?.showModal();
    dialog?.focus();
    return () => {
      dialog?.close();
      background.forEach((element, index) => {
        element.inert = previous[index] ?? false;
      });
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return createPortal(
    <div
      ref={overlay}
      className="ux-dialog-overlay"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
        if (event.key === 'Tab') {
          const focusable = Array.from(
            panel.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
            ) ?? [],
          ).filter((element) => element.getClientRects().length > 0);
          const first = focusable[0];
          const last = focusable.at(-1);
          if (!first) {
            event.preventDefault();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === panel.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (
            !event.shiftKey &&
            (document.activeElement === last || document.activeElement === panel.current)
          ) {
            event.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <dialog
        ref={panel}
        tabIndex={-1}
        className={`ux-dialog${wide ? ' ux-dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <header className="ux-dialog__header">
          <h2 id={id}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={text('common.close')}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="ux-dialog__body">{children}</div>
      </dialog>
    </div>,
    document.body,
  );
}
