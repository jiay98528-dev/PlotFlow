import type { Diagnostic, DiagnosticMessageParams } from '@plotflow/core';
import { appT } from './appI18n';
import type { Language } from '../stores/uiStore';

function normalizeParams(
  params: DiagnosticMessageParams | undefined,
): Readonly<Record<string, string | number>> | undefined {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, typeof value === 'boolean' ? String(value) : value]),
  );
}

function localizedOrFallback(
  key: string | undefined,
  params: DiagnosticMessageParams | undefined,
  fallback: string | undefined,
  language: Language,
): string | undefined {
  if (!key) return fallback;
  const localized = appT(key, normalizeParams(params), language);
  return localized === key ? fallback : localized;
}

export interface LocalizedDiagnosticText {
  readonly message: string;
  readonly detail?: string;
}

/** Localizes diagnostics only at the UI boundary; core remains locale-neutral. */
export function localizeDiagnostic(
  diagnostic: Diagnostic,
  language: Language,
): LocalizedDiagnosticText {
  return {
    message: localizedOrFallback(
      diagnostic.messageKey ?? `diagnostic.${diagnostic.code}.message`,
      diagnostic.messageParams,
      diagnostic.message,
      language,
    ) ?? diagnostic.message,
    detail: localizedOrFallback(
      diagnostic.detailKey,
      diagnostic.detailParams,
      diagnostic.detail,
      language,
    ),
  };
}
