import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export interface IpcSenderLike {
  readonly senderFrame?: { readonly url: string } | null;
}

export function trustedRendererUrls(options: {
  readonly rendererHtmlPath: string;
  readonly developmentUrl?: string;
}): readonly string[] {
  const urls = [pathToFileURL(resolve(options.rendererHtmlPath)).href];
  if (options.developmentUrl) urls.push(new URL(options.developmentUrl).href);
  return urls;
}

export function developmentRendererUrl(isPackaged: boolean, candidate?: string): string | undefined {
  if (isPackaged || !candidate) return undefined;
  try {
    const url = new URL(candidate);
    const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
    return ['http:', 'https:'].includes(url.protocol) && loopbackHosts.has(url.hostname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function isTrustedRendererUrl(candidate: string, trustedUrls: readonly string[]): boolean {
  if (!candidate) return false;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }

  return trustedUrls.some((trusted) => {
    const expected = new URL(trusted);
    if (expected.protocol === 'file:') {
      const candidatePath = parsed.pathname.replaceAll('\\', '/');
      return parsed.protocol === 'file:'
        && candidatePath === expected.pathname.replaceAll('\\', '/');
    }
    return parsed.origin === expected.origin;
  });
}

export function assertTrustedIpcSender(event: IpcSenderLike, trustedUrls: readonly string[]): void {
  const senderUrl = event.senderFrame?.url ?? '';
  if (!isTrustedRendererUrl(senderUrl, trustedUrls)) {
    throw new Error(`Rejected IPC from untrusted renderer origin: ${senderUrl || '<missing>'}`);
  }
}

const ALLOWED_EXTERNAL_URLS = new Set(['https://plotflow.app/themes']);

export function isAllowedExternalUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.username === '' && url.password === '' && ALLOWED_EXTERNAL_URLS.has(url.href.replace(/\/$/, ''));
  } catch {
    return false;
  }
}
