import { describe, expect, it } from 'vitest';
import { compositeOnBackground, contrastRatio, relativeLuminance } from './contrast';

describe('theme contrast utilities', () => {
  it('calculates WCAG contrast ratios from sRGB colors', () => {
    expect(relativeLuminance({ red: 0, green: 0, blue: 0 })).toBe(0);
    expect(contrastRatio({ red: 255, green: 255, blue: 255 }, { red: 0, green: 0, blue: 0 })).toBe(21);
  });

  it('composites translucent focus materials before contrast checks', () => {
    expect(compositeOnBackground(
      { red: 0, green: 0, blue: 0, alpha: 0.5 },
      { red: 255, green: 255, blue: 255 },
    )).toEqual({ red: 127.5, green: 127.5, blue: 127.5 });
  });
});
