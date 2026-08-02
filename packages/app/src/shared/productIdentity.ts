import rootPackage from '../../../../package.json';

export type ReleaseChannel = 'preview' | 'stable';

function resolveReleaseChannel(value: string): ReleaseChannel {
  if (value === 'preview' || value === 'stable') return value;
  throw new Error(`Unsupported release channel: ${value}`);
}

export const APP_VERSION = rootPackage.version;
export const APP_RELEASE_CHANNEL = resolveReleaseChannel(rootPackage.releaseChannel);

export function formatDisplayVersion(
  version: string = APP_VERSION,
  releaseChannel: ReleaseChannel = APP_RELEASE_CHANNEL,
): string {
  return `V${version}${releaseChannel === 'preview' ? ' Preview' : ''}`;
}

export const APP_VERSION_LABEL = formatDisplayVersion();

export const FABLEVIA_BRAND = {
  englishName: rootPackage.productName,
  chineseName: rootPackage.displayNameZh,
  legacyTechnicalNamespace: 'plotflow',
} as const;
