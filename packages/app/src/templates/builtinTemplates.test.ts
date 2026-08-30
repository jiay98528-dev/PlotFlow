import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyTemplate, parseStory } from '@plotflow/core';
import { BUILTIN_TEMPLATES } from './builtinTemplates';

const TEMPLATE_VARS = {
  title: 'M6 Verification',
  author: 'Fablevia Test',
  engine: 'generic',
} as const;

const TEMPLATE_FILES = [
  '../../../../templates/rpg-dialogue.mdstory',
  '../../../../templates/visual-novel.mdstory',
  '../../../../templates/puzzle-escape.mdstory',
  '../../../../templates/godot-example/story.mdstory',
] as const;

describe('built-in templates', () => {
  it('all app templates parse as Fablevia stories', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const rendered = applyTemplate(template.content, {
        ...TEMPLATE_VARS,
        engine: template.engine,
      });
      const result = parseStory(rendered);

      expect(result.ok, template.id).toBe(true);
      if (result.ok) {
        const nodeCount = result.data.chapters.reduce(
          (sum, chapter) => sum + chapter.nodes.length,
          0,
        );
        expect(nodeCount).toBe(template.nodeCount);
      }
    }
  });

  it('all repository template files parse as Fablevia stories', () => {
    for (const path of TEMPLATE_FILES) {
      const raw = readFileSync(new URL(path, import.meta.url), 'utf8');
      const rendered = applyTemplate(raw, {
        ...TEMPLATE_VARS,
        engine: path.includes('godot') ? 'godot' : 'generic',
      });
      const result = parseStory(rendered);

      expect(result.ok, path).toBe(true);
      if (result.ok) {
        expect(result.data.chapters.length).toBeGreaterThan(0);
      }
    }
  });
});
