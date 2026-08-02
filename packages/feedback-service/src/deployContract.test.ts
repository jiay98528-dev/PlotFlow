import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const activationScript = fileURLToPath(
  new URL('../deploy/activate-release.sh', import.meta.url),
);

describe('atomic deployment contract', () => {
  it('rolls back restart failures and removes a broken first-deploy link', async () => {
    const source = await readFile(activationScript, 'utf8');

    expect(source).toMatch(
      /if systemctl restart fablevia-feedback\.service \\\n+  && curl --fail[\s\S]+healthz/u,
    );
    expect(source).toMatch(/mv -Tf "\$ROLLBACK_LINK" "\$CURRENT"/u);
    expect(source).toMatch(/else\s+rm -f "\$CURRENT"\s+systemctl stop/u);
  });
});
