import { describe, expect, it } from 'vitest';
import { createFullId } from '@plotflow/core';
import { migrateLegacyGraphLayoutKeys } from './graphLayoutMigration';

describe('migrateLegacyGraphLayoutKeys', () => {
  it('rewrites unique legacy keys and preserves CRLF', () => {
    const source = [
      '---',
      'layout:',
      '  graph:',
      '    version: 1',
      '    nodes:',
      '      - id: Chapter-Start',
      '        x: 1',
      '        y: 2',
      '---',
      '# Chapter',
      '## 节点：Start',
      'Body.',
      '',
    ].join('\r\n');

    const migrated = migrateLegacyGraphLayoutKeys(source);
    expect(migrated).toContain(`      - id: ${JSON.stringify(createFullId('Chapter', 'Start'))}`);
    expect(migrated).not.toMatch(/(?<!\r)\n/u);
  });

  it('does not guess an ambiguous legacy key', () => {
    const source = `---
layout:
  graph:
    version: 1
    nodes:
      - id: A-B-C
        x: 1
        y: 2
---
# A-B
## 节点：C
First.
# A
## 节点：B-C
Second.
`;

    expect(migrateLegacyGraphLayoutKeys(source)).toBe(source);
  });
});
