import { describe, expect, it } from 'vitest';
import { applyTemplate } from '../template/TemplateEngine.js';

describe('TemplateEngine', () => {
  it('replaces known placeholders', () => {
    const result = applyTemplate('title={{title}}, author={{author}}', {
      title: 'Forest Gate',
      author: 'PlotFlow',
    });

    expect(result).toBe('title=Forest Gate, author=PlotFlow');
  });

  it('keeps unknown placeholders intact', () => {
    const result = applyTemplate('engine={{engine}}, missing={{missing}}', {
      engine: 'godot',
    });

    expect(result).toBe('engine=godot, missing={{missing}}');
  });
});
