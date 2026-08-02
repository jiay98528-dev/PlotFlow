import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const activationScript = fileURLToPath(
  new URL('../deploy/activate-release.sh', import.meta.url),
);

describe('atomic deployment contract', () => {
  it('waits for startup and rolls back a failed first deployment', async () => {
    const source = await readFile(activationScript, 'utf8');

    expect(source).toContain('if systemctl restart fablevia-feedback.service; then');
    expect(source).toContain('while [ "$ATTEMPT" -lt 10 ]; do');
    expect(source).toMatch(/curl --fail[\s\S]+healthz/u);
    expect(source).toMatch(/mv -Tf "\$ROLLBACK_LINK" "\$CURRENT"/u);
    expect(source).toMatch(/else\s+rm -f "\$CURRENT"\s+systemctl stop/u);
  });
});
