// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackSubmitRequest, FeedbackSubmitResult } from '../../shared/feedback';
import { FeedbackDialog } from './FeedbackDialog';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function setTextareaValue(element: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('FeedbackDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  it('is a Help-controlled modal with no floating launcher', () => {
    const opener = document.createElement('button');
    document.body.prepend(opener);
    opener.focus();
    const onClose = vi.fn();
    const onSubmit = vi.fn<() => Promise<FeedbackSubmitResult>>();

    act(() => {
      root.render(
        <FeedbackDialog
          isOpen
          locale="zh-CN"
          onClose={onClose}
          onSubmit={onSubmit}
          createRequestId={() => '123e4567-e89b-42d3-a456-426614174000'}
        />,
      );
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
    expect(dialog).not.toBeNull();
    expect(textarea).toBe(document.activeElement);
    expect(document.querySelector('[data-testid="feedback-trigger"]')).toBeNull();
    expect(container.getAttribute('aria-hidden')).toBe('true');

    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(onClose).toHaveBeenCalledOnce();
    act(() => {
      root.render(
        <FeedbackDialog isOpen={false} locale="zh-CN" onClose={onClose} onSubmit={onSubmit} />,
      );
    });
    expect(document.activeElement).toBe(opener);
    expect(container.hasAttribute('aria-hidden')).toBe(false);
  });

  it('traps focus and submits exactly message, locale and requestId', async () => {
    let resolveSubmission: ((result: FeedbackSubmitResult) => void) | undefined;
    const onSubmit = vi.fn<(request: FeedbackSubmitRequest) => Promise<FeedbackSubmitResult>>(
      () =>
        new Promise((resolve) => {
          resolveSubmission = resolve;
        }),
    );
    act(() => {
      root.render(
        <FeedbackDialog
          isOpen
          locale="en-US"
          onClose={() => undefined}
          onSubmit={onSubmit}
          createRequestId={() => '123e4567-e89b-42d3-a456-426614174000'}
        />,
      );
    });

    const dialog = document.querySelector<HTMLFormElement>('form[role="dialog"]');
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
    const closeButton = dialog?.querySelector<HTMLButtonElement>('.icon-button');
    const submitButton = dialog?.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(dialog).not.toBeNull();
    expect(textarea).not.toBeNull();
    expect(closeButton).not.toBeNull();
    expect(submitButton).not.toBeNull();

    closeButton?.focus();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
        }),
      ),
    );
    expect(document.activeElement).toBe(submitButton);

    await act(async () => {
      if (textarea) setTextareaValue(textarea, '  Reproduction steps  ');
    });
    await act(async () => {
      dialog?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledOnce();
    const request = onSubmit.mock.calls[0]?.[0];
    expect(request).toEqual({
      message: 'Reproduction steps',
      locale: 'en-US',
      requestId: '123e4567-e89b-42d3-a456-426614174000',
    });
    expect(Object.keys(request ?? {}).sort()).toEqual(['locale', 'message', 'requestId']);

    await act(async () => {
      resolveSubmission?.({ ok: true, reportId: 'FB-test' });
      await Promise.resolve();
    });
    expect(document.querySelector('[role="status"]')).not.toBeNull();
  });

  it('keeps one requestId across a retry and exposes the public error code', async () => {
    const onSubmit = vi
      .fn<(request: FeedbackSubmitRequest) => Promise<FeedbackSubmitResult>>()
      .mockResolvedValueOnce({ ok: false, code: 'rate_limited' })
      .mockResolvedValueOnce({ ok: true, reportId: 'FB-retry' });
    const createRequestId = vi.fn(() => '123e4567-e89b-42d3-a456-426614174000');
    act(() => {
      root.render(
        <FeedbackDialog
          isOpen
          locale="zh-CN"
          onClose={() => undefined}
          onSubmit={onSubmit}
          createRequestId={createRequestId}
        />,
      );
    });
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
    const form = document.querySelector<HTMLFormElement>('form');
    await act(async () => {
      if (textarea) setTextareaValue(textarea, 'Same report');
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(document.querySelector('[data-feedback-error-code="rate_limited"]')).not.toBeNull();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(createRequestId).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0]?.[0].requestId).toBe(onSubmit.mock.calls[1]?.[0].requestId);
  });
});
