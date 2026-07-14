import { describe, expect, it } from 'vitest';
import { assertTrustedIpcSender, developmentRendererUrl, isAllowedExternalUrl, isTrustedRendererUrl } from './ipcSecurity';

describe('Electron origin boundary', () => {
  const trusted = ['file:///C:/PlotFlow/resources/app.asar/out/renderer/index.html', 'http://localhost:5173/'];

  it('accepts only the exact packaged entry or exact dev origin', () => {
    expect(isTrustedRendererUrl('file:///C:/PlotFlow/resources/app.asar/out/renderer/index.html', trusted)).toBe(true);
    expect(isTrustedRendererUrl('file:///C:/PlotFlow/resources/app.asar/out/renderer/sibling.html', trusted)).toBe(false);
    expect(isTrustedRendererUrl('http://localhost:5173/graph', trusted)).toBe(true);
    expect(isTrustedRendererUrl('https://evil.example/', trusted)).toBe(false);
    expect(() => assertTrustedIpcSender({ senderFrame: { url: 'https://evil.example/' } }, trusted)).toThrow(/untrusted/);
  });

  it('never enables a development renderer URL in packaged mode', () => {
    expect(developmentRendererUrl(true, 'https://evil.example/app')).toBeUndefined();
    expect(developmentRendererUrl(false, 'https://evil.example/app')).toBeUndefined();
    expect(developmentRendererUrl(false, 'http://localhost:5173/')).toBe('http://localhost:5173/');
  });

  it('restricts system-browser navigation to the fixed product allowlist', () => {
    expect(isAllowedExternalUrl('https://plotflow.app/themes')).toBe(true);
    expect(isAllowedExternalUrl('https://plotflow.app/themes/anything')).toBe(false);
    expect(isAllowedExternalUrl('https://evil.example/')).toBe(false);
  });
});
