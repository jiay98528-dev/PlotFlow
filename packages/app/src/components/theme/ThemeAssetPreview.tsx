import React, { useEffect, useState } from 'react';
import { getTheme } from '../../theme-platform/registry';

interface ThemeAssetPreviewProps {
  readonly themeId: string;
  readonly src: string;
  readonly label: string;
  readonly compact?: boolean;
  readonly active?: boolean;
}

/**
 * Displays a captured workspace rendered by the actual theme implementation.
 * The image stays inert so previews cannot mutate graph selection or story state.
 */
export function ThemeAssetPreview({
  themeId,
  src,
  label,
  compact = false,
  active = false,
}: ThemeAssetPreviewProps): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const theme = getTheme(themeId);
  const previewTokens = theme ? { ...theme.tokens.shared, ...theme.tokens[theme.defaultMode] } : {};

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <figure
      style={previewTokens as React.CSSProperties}
      className={`official-theme-preview official-theme-preview--rendered${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}`}
      data-preview-theme-id={themeId}
      data-official-preview-theme={themeId}
      data-preview-source="rendered-workspace"
    >
      {failed ? (
        <div className="official-theme-preview__fallback" role="img" aria-label={label}>
          <span>{label}</span>
        </div>
      ) : (
        <img
          className="official-theme-preview__image"
          data-testid="theme-rendered-preview"
          src={src}
          alt={label}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  );
}
