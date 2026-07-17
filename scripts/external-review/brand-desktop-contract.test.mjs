import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function source(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

test('desktop package exposes Fablevia while retaining the upgrade identity', async () => {
  const config = await source('electron-builder.config.js');
  assert.match(config, /appId: 'com\.plotflow\.app'/);
  assert.match(config, /productName: 'Fablevia'/);
  assert.match(config, /name: 'Fablevia\.Story'/);
  assert.match(config, /artifactName: 'Fablevia Setup \$\{version\}\.\$\{ext\}'/);
  assert.match(config, /guid: '74fc8b73-b58d-5573-82e7-75efc9ec526f'/);
  assert.match(config, /shortcutName: 'Fablevia'/);
  assert.match(config, /uninstallDisplayName: 'Fablevia'/);
});

test('main process pins userData to the established profile and localizes native branding', async () => {
  const main = await source('packages/app/src-electron/main.ts');
  const i18n = await source('packages/app/src-electron/mainProcessI18n.ts');
  assert.match(main, /LEGACY_USER_DATA_DIRECTORY = 'PlotFlow';[^\n]*brand-compat/);
  assert.match(main, /app\.setPath\('userData', join\(app\.getPath\('appData'\), LEGACY_USER_DATA_DIRECTORY\)\)/);
  assert.match(main, /app\.setName\(PRODUCT_NAME\)/);
  assert.match(i18n, /productName: '维叙（Fablevia）'/);
  assert.match(i18n, /productName: 'Fablevia'/);
});

test('installer owns the new association and only removes bound legacy registrations', async () => {
  const installer = await source('build/installer.nsh');
  assert.match(installer, /!define FABLEVIA_PROGID "Fablevia\.Story"/);
  assert.match(installer, /WriteRegStr HKLM "Software\\Classes\\\.mdstory" "" "\$\{FABLEVIA_PROGID\}"/);
  assert.match(installer, /!macro RemoveOwnedAssociation ROOT CLASS EXECUTABLE/);
  assert.match(installer, /ReadRegStr \$R3 HKLM .*Uninstall.*FABLEVIA_PRODUCT_GUID.*InstallLocation/);
  assert.match(installer, /Delete "\$INSTDIR\\PlotFlow\.exe"[^\n]*brand-compat/);
  assert.doesNotMatch(installer, /DeleteRegKey HK(?:LM|CU) "Software\\Classes\\PlotFlow(?: Story|\.Story)"\s*$/m);
});
