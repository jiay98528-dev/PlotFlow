import React, { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import { useAppText } from '../../i18n/appI18n';
import { useUIStore } from '../../stores/uiStore';
import type {
  FeedbackLocale,
  FeedbackSubmitRequest,
  FeedbackSubmitResult,
} from '../../shared/feedback';
import { FEEDBACK_MESSAGE_MAX_CHARACTERS } from '../../shared/feedback';

type FeedbackSubmitter = (request: FeedbackSubmitRequest) => Promise<FeedbackSubmitResult>;

export interface FeedbackDialogProps {
  readonly isOpen: boolean;
  readonly locale: FeedbackLocale;
  readonly onClose: () => void;
  readonly onSubmit: FeedbackSubmitter;
  readonly createRequestId?: () => string;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface InertSnapshot {
  readonly element: HTMLElement;
  readonly ariaHidden: string | null;
  readonly hadInertAttribute: boolean;
}

function setBackgroundInert(overlay: HTMLElement): () => void {
  const snapshots: InertSnapshot[] = [];
  for (const child of document.body.children) {
    if (!(child instanceof HTMLElement) || child === overlay) continue;
    snapshots.push({
      element: child,
      ariaHidden: child.getAttribute('aria-hidden'),
      hadInertAttribute: child.hasAttribute('inert'),
    });
    child.inert = true;
    child.setAttribute('aria-hidden', 'true');
  }

  return () => {
    for (const snapshot of snapshots) {
      if (!snapshot.hadInertAttribute) snapshot.element.removeAttribute('inert');
      if (snapshot.ariaHidden === null) snapshot.element.removeAttribute('aria-hidden');
      else snapshot.element.setAttribute('aria-hidden', snapshot.ariaHidden);
    }
  };
}

function defaultRequestId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Controlled feedback modal. It intentionally renders no launcher: the native Help menu is
 * the sole entry point and owns `isOpen` through the UI store.
 */
export function FeedbackDialog({
  isOpen,
  locale,
  onClose,
  onSubmit,
  createRequestId = defaultRequestId,
}: FeedbackDialogProps): React.ReactElement | null {
  const text = useAppText();
  const titleId = useId();
  const descriptionId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const requestIdRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorCode, setErrorCode] = useState<
    Exclude<FeedbackSubmitResult, { ok: true }>['code'] | null
  >(null);

  const requestClose = useCallback(() => {
    attemptRef.current += 1;
    onClose();
  }, [onClose]);
  closeRef.current = requestClose;

  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setStatus('idle');
    setErrorCode(null);
    inputRef.current?.focus();

    const overlay = overlayRef.current;
    const restoreBackground = overlay ? setBackgroundInert(overlay) : () => undefined;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      restoreBackground();
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const normalizedMessage = message.trim();
    if (
      normalizedMessage.length === 0 ||
      [...normalizedMessage].length > FEEDBACK_MESSAGE_MAX_CHARACTERS
    ) {
      setStatus('error');
      setErrorCode('invalid');
      return;
    }

    const requestId = requestIdRef.current ?? createRequestId();
    requestIdRef.current = requestId;
    const attempt = ++attemptRef.current;
    setStatus('sending');
    setErrorCode(null);

    try {
      const result = await onSubmit({
        message: normalizedMessage,
        locale,
        requestId,
      });
      if (attempt !== attemptRef.current) return;
      if (!result.ok) {
        setStatus('error');
        setErrorCode(result.code);
        return;
      }
      requestIdRef.current = null;
      setMessage('');
      setStatus('success');
    } catch {
      if (attempt !== attemptRef.current) return;
      setStatus('error');
      setErrorCode('unavailable');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="feedback-dialog__overlay"
      data-testid="feedback-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <form
        ref={dialogRef}
        className="feedback-dialog__panel"
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        role="dialog"
        tabIndex={-1}
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <header className="feedback-dialog__header">
          <div>
            <p>{text('feedback.eyebrow')}</p>
            <h2 id={titleId}>{text('feedback.title')}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={text('feedback.close')}
            onClick={requestClose}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {status === 'success' ? (
          <div className="feedback-dialog__result" role="status">
            <strong>{text('feedback.sentTitle')}</strong>
            <p id={descriptionId}>{text('feedback.sentDescription')}</p>
            <button type="button" className="button button--primary" onClick={requestClose}>
              {text('common.done')}
            </button>
          </div>
        ) : (
          <>
            <label className="feedback-dialog__field">
              <span>{text('feedback.messageLabel')}</span>
              <textarea
                ref={inputRef}
                value={message}
                required
                disabled={status === 'sending'}
                placeholder={text('feedback.placeholder')}
                onChange={(event) => {
                  setMessage(
                    [...event.target.value].slice(0, FEEDBACK_MESSAGE_MAX_CHARACTERS).join(''),
                  );
                  requestIdRef.current = null;
                  if (status === 'error') {
                    setStatus('idle');
                    setErrorCode(null);
                  }
                }}
              />
            </label>
            <p id={descriptionId} className="feedback-dialog__privacy">
              {text('feedback.privacyHint')}
            </p>
            {errorCode ? (
              <p
                className="feedback-dialog__error"
                data-feedback-error-code={errorCode}
                role="alert"
              >
                {text(
                  `feedback.errors.${errorCode === 'rate_limited' ? 'rateLimited' : errorCode}`,
                )}
              </p>
            ) : null}
            <footer className="feedback-dialog__footer">
              <button type="button" className="button button--secondary" onClick={requestClose}>
                {text('common.cancel')}
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={status === 'sending'}
              >
                <Send aria-hidden="true" size={16} />
                <span>
                  {status === 'sending' ? text('feedback.sending') : text('feedback.send')}
                </span>
              </button>
            </footer>
          </>
        )}
      </form>
    </div>,
    document.body,
  );
}

/** Store-connected host used once at the renderer root; it does not render an entry button. */
export function FeedbackDialogHost(): React.ReactElement | null {
  const isOpen = useUIStore((state) => state.isFeedbackDialogOpen);
  const locale = useUIStore((state) => state.language);
  const close = useUIStore((state) => state.closeFeedbackDialog);
  const submit = useCallback<FeedbackSubmitter>((request) => {
    return window.plotflow.feedback.send(request);
  }, []);

  return <FeedbackDialog isOpen={isOpen} locale={locale} onClose={close} onSubmit={submit} />;
}
