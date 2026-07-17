import React from 'react';
import brandIconUrl from '../../assets/fablevia-icon.svg';
import { resolveBrandPresentation } from '../../branding/brand';
import { useUIStore, type Language } from '../../stores/uiStore';

export type BrandLockupVariant = 'default' | 'compact' | 'hero';

export interface BrandLockupProps {
  readonly variant?: BrandLockupVariant;
  readonly language?: Language;
  readonly showIcon?: boolean;
  readonly className?: string;
}

export function BrandLockup({
  variant = 'default',
  language: languageOverride,
  showIcon = true,
  className = '',
}: BrandLockupProps): React.ReactElement {
  const activeLanguage = useUIStore((state) => state.language);
  const language = languageOverride ?? activeLanguage;
  const brand = resolveBrandPresentation(language);
  const classes = ['brand-lockup', `brand-lockup--${variant}`, className].filter(Boolean).join(' ');

  return (
    <span className={classes} aria-label={brand.accessibleName} data-language={language}>
      {showIcon ? (
        <span className="app-logo brand-lockup__icon" aria-hidden="true">
          <img src={brandIconUrl} alt="" />
        </span>
      ) : null}
      <span className="brand-lockup__wordmark" aria-hidden="true">
        <span className="brand-lockup__primary">{brand.primaryName}</span>
        {brand.secondaryName ? (
          <span className="brand-lockup__secondary">{brand.secondaryName}</span>
        ) : null}
      </span>
    </span>
  );
}
