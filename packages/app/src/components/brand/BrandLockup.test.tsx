import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandLockup } from './BrandLockup';

describe('BrandLockup', () => {
  it('renders the Chinese name first and the English name as supporting text', () => {
    const markup = renderToStaticMarkup(<BrandLockup language="zh-CN" variant="hero" />);

    expect(markup).toContain('aria-label="维叙（Fablevia）"');
    expect(markup).toContain('brand-lockup__primary">维叙');
    expect(markup).toContain('brand-lockup__secondary">Fablevia');
    expect(markup).toContain('brand-lockup--hero');
  });

  it('renders no Chinese or empty supporting-name placeholder in English', () => {
    const markup = renderToStaticMarkup(<BrandLockup language="en-US" variant="compact" />);

    expect(markup).toContain('aria-label="Fablevia"');
    expect(markup).toContain('brand-lockup__primary">Fablevia');
    expect(markup).not.toContain('维叙');
    expect(markup).not.toContain('brand-lockup__secondary');
  });
});
