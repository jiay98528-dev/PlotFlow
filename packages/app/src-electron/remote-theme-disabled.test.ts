import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appRoot = fileURLToPath(new URL('../', import.meta.url));

function readAppFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');
}

describe('0.1.1 remote theme security boundary', () => {
  it('does not expose registry, install, protocol, or runtime-loading paths', () => {
    const main = readAppFile('src-electron/main.ts');
    const preload = readAppFile('src-electron/preload.ts');
    const provider = readAppFile('src/components/ThemePlatformProvider.tsx');
    const csp = readAppFile('index.html');

    expect(main).not.toContain('official-theme-service');
    expect(main).not.toContain('registerOfficialThemeProtocol');
    expect(main).not.toContain('downloadOfficialTheme');
    expect(main).not.toContain('PLOTFLOW_OFFICIAL_THEME_REGISTRY_URL');
    expect(main).not.toContain('official-themes');
    expect(preload).not.toContain('IPC_CHANNELS.theme');
    expect(preload).not.toContain('theme: {');
    expect(provider).not.toContain('listOfficialInstalled');
    expect(provider).not.toContain('officialRemoteThemes');
    expect(provider).not.toMatch(/\bfetch\s*\(/u);
    expect(provider).not.toMatch(/\bimport\s*\(/u);
    expect(csp).not.toContain('plotflow-theme:');
  });

  it('does not ship executable remote-theme runtime modules', () => {
    expect(existsSync(`${appRoot}src-electron/official-theme-service.ts`)).toBe(false);
    expect(existsSync(`${appRoot}src/theme/officialRemoteThemes.ts`)).toBe(false);
  });
});
