import type { Language } from '../stores/uiStore';

export const FABLEVIA_BRAND = {
  englishName: 'Fablevia',
  chineseName: '维叙',
  legacyTechnicalNamespace: 'plotflow',
} as const;

export interface BrandPresentation {
  readonly primaryName: string;
  readonly secondaryName: string | null;
  readonly accessibleName: string;
  readonly plainTextName: string;
}

export function resolveBrandPresentation(language: Language): BrandPresentation {
  if (language === 'zh-CN') {
    return {
      primaryName: FABLEVIA_BRAND.chineseName,
      secondaryName: FABLEVIA_BRAND.englishName,
      accessibleName: `${FABLEVIA_BRAND.chineseName}（${FABLEVIA_BRAND.englishName}）`,
      plainTextName: `${FABLEVIA_BRAND.chineseName}（${FABLEVIA_BRAND.englishName}）`,
    };
  }

  return {
    primaryName: FABLEVIA_BRAND.englishName,
    secondaryName: null,
    accessibleName: FABLEVIA_BRAND.englishName,
    plainTextName: FABLEVIA_BRAND.englishName,
  };
}
