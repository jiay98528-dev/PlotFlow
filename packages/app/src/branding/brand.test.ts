import { describe, expect, it } from 'vitest';
import { FABLEVIA_BRAND, resolveBrandPresentation } from './brand';

describe('Fablevia brand contract', () => {
  it('presents Chinese as the primary name with a supporting English name', () => {
    expect(resolveBrandPresentation('zh-CN')).toEqual({
      primaryName: '维叙',
      secondaryName: 'Fablevia',
      accessibleName: '维叙（Fablevia）',
      plainTextName: '维叙（Fablevia）',
    });
  });

  it('presents only the English name in English', () => {
    expect(resolveBrandPresentation('en-US')).toEqual({
      primaryName: 'Fablevia',
      secondaryName: null,
      accessibleName: 'Fablevia',
      plainTextName: 'Fablevia',
    });
  });

  it('keeps the legacy technical namespace explicit and separate from the product name', () => {
    expect(FABLEVIA_BRAND.legacyTechnicalNamespace).toBe('plotflow');
  });
});
