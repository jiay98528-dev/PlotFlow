/**
 * 主题可访问性使用的最小颜色数学工具。
 * 所有通道均使用 0..255 sRGB，alpha 使用 0..1，避免把测试逻辑耦合到某个主题。
 */
export interface RgbaColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha?: number;
}

export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

function toLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: RgbColor): number {
  return (
    0.2126 * toLinear(color.red) +
    0.7152 * toLinear(color.green) +
    0.0722 * toLinear(color.blue)
  );
}

export function contrastRatio(first: RgbColor, second: RgbColor): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/** 将半透明主题色合成到不透明阅读面后再计算对比度。 */
export function compositeOnBackground(foreground: RgbaColor, background: RgbColor): RgbColor {
  const alpha = foreground.alpha ?? 1;
  return {
    red: foreground.red * alpha + background.red * (1 - alpha),
    green: foreground.green * alpha + background.green * (1 - alpha),
    blue: foreground.blue * alpha + background.blue * (1 - alpha),
  };
}
