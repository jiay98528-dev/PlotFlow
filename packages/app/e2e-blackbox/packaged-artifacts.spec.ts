import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  getBlackboxArtifactRoot,
  getBlackboxTarget,
  PROJECT_ROOT,
} from './helpers/electronBlackbox';

const execFileAsync = promisify(execFile);

interface AsarNode {
  readonly files?: Record<string, AsarNode>;
}

function listAsarFiles(bytes: Buffer): string[] {
  const headerJsonSize = bytes.readUInt32LE(12);
  const header = JSON.parse(bytes.slice(16, 16 + headerJsonSize).toString('utf-8')) as AsarNode;
  const files: string[] = [];

  const visit = (node: AsarNode, prefix: string): void => {
    for (const [name, child] of Object.entries(node.files ?? {})) {
      const path = prefix ? `${prefix}/${name}` : name;
      files.push(path);
      visit(child, path);
    }
  };

  visit(header, '');
  return files;
}

test.describe('blackbox packaged artifact checks', () => {
  test('packaged app resources are present and do not bundle the website @edge @packaged', async () => {
    const target = getBlackboxTarget();
    test.skip(target === 'devBuild', 'Packaged artifact check only applies to winUnpacked or installedExe targets.');

    const artifactRoot = getBlackboxArtifactRoot(target);
    if (!artifactRoot) {
      throw new Error(`No artifact root for ${target}.`);
    }

    const executable = target === 'installedExe'
      ? process.env['PLOTFLOW_INSTALLED_EXE']
      : join(artifactRoot, 'PlotFlow.exe');
    expect(executable && existsSync(executable)).toBeTruthy();

    const resourcesDir = join(artifactRoot, 'resources');
    const appAsar = join(resourcesDir, 'app.asar');
    const fileIcon = join(resourcesDir, 'file-icon.ico');
    expect(existsSync(appAsar)).toBeTruthy();
    expect(existsSync(fileIcon)).toBeTruthy();
    await expect.poll(async () => (await stat(fileIcon)).size).toBeGreaterThan(1_000);

    const asarFiles = listAsarFiles(await readFile(appAsar));
    expect(asarFiles.some((file) => file === 'website' || file.startsWith('website/'))).toBe(false);
    expect(asarFiles.some((file) => file === 'dist-static' || file.startsWith('dist-static/'))).toBe(false);
  });

  test('release debug metadata records installer language, include, and file association @edge @packaged @unpacked', async () => {
    const target = getBlackboxTarget();
    test.skip(target !== 'winUnpacked', 'Builder metadata is checked against the freshly produced release directory.');

    const debugPath = join(PROJECT_ROOT, 'release', 'builder-debug.yml');
    expect(existsSync(debugPath)).toBeTruthy();
    const debug = await readFile(debugPath, 'utf-8');
    expect(debug).toContain('MUI_LANGDLL_DISPLAY');
    expect(debug).toContain('MUI_LANGUAGE "SimpChinese"');
    expect(debug).toContain('MUI_LANGUAGE "English"');
    expect(debug).toContain('installer.nsh');
    expect(debug).toContain('APP_ASSOCIATE "mdstory"');
    expect(debug).toContain('file-icon.ico');
  });

  test('installed app registers mdstory file association with an icon @edge @packaged @installed', async () => {
    const target = getBlackboxTarget();
    test.skip(target !== 'installedExe', 'Registry file association check only applies to installedExe target.');
    test.skip(process.platform !== 'win32', 'Windows registry check only runs on Windows.');

    const script = `
$key = [Microsoft.Win32.Registry]::ClassesRoot.OpenSubKey('.mdstory')
$assoc = if ($key -ne $null) { [string]$key.GetValue('') } else { '' }
$icon = ''
if ($assoc.Length -gt 0) {
  $iconKey = [Microsoft.Win32.Registry]::ClassesRoot.OpenSubKey("$assoc\\DefaultIcon")
  if ($iconKey -ne $null) { $icon = [string]$iconKey.GetValue('') }
}
[Console]::Out.WriteLine($assoc)
[Console]::Out.WriteLine($icon)
`;
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      timeout: 10_000,
    });
    const [association = '', icon = ''] = stdout.split(/\r?\n/).map((line) => line.trim());
    expect(association).not.toBe('');
    expect(icon.toLowerCase()).toContain('file-icon.ico');
  });
});
