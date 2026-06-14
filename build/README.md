# PlotFlow 应用图标

`icon.svg` 是 PlotFlow 应用图标的源文件（48×48 viewBox），可用于生成各平台所需的图标格式。

## Windows (.ico)

使用 [ImageMagick](https://imagemagick.org/) 将 SVG 转换为 ICO：

```bash
magick convert icon.svg -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

或者使用在线工具（如 [Convertio](https://convertio.co/svg-ico/)）。

## macOS (.icns)

### 方案一：通过 PNG 中间格式（推荐）

```bash
# 1. 将 SVG 导出为不同尺寸的 PNG（1024×1024 最大）
magick convert icon.svg -resize 1024x1024 icon-1024.png
magick convert icon.svg -resize 512x512 icon-512.png
magick convert icon.svg -resize 256x256 icon-256.png
magick convert icon.svg -resize 128x128 icon-128.png
magick convert icon.svg -resize 64x64 icon-64.png
magick convert icon.svg -resize 32x32 icon-32.png
magick convert icon.svg -resize 16x16 icon-16.png

# 2. 创建 iconset 目录
mkdir PlotFlow.iconset

# 3. 按 Apple 规范命名并放置 PNG
cp icon-1024.png PlotFlow.iconset/icon_512x512@2x.png
cp icon-512.png  PlotFlow.iconset/icon_512x512.png
cp icon-512.png  PlotFlow.iconset/icon_256x256@2x.png
cp icon-256.png  PlotFlow.iconset/icon_256x256.png
cp icon-256.png  PlotFlow.iconset/icon_128x128@2x.png
cp icon-128.png  PlotFlow.iconset/icon_128x128.png
cp icon-64.png   PlotFlow.iconset/icon_32x32@2x.png
cp icon-32.png   PlotFlow.iconset/icon_32x32.png
cp icon-32.png   PlotFlow.iconset/icon_16x16@2x.png
cp icon-16.png   PlotFlow.iconset/icon_16x16.png

# 4. 使用 iconutil 生成 .icns
iconutil -c icns PlotFlow.iconset
```

### 方案二：在线工具

使用 [iConvert](https://iconvert.icons8.com/) 或 [CloudConvert](https://cloudconvert.com/svg-to-icns) 直接 SVG → ICNS。

## Linux

Linux 桌面环境直接使用 SVG 或转换为 PNG：

```bash
# 转换为 256×256 PNG
magick convert icon.svg -resize 256x256 icon.png
```

将生成的 PNG 放置到 `/usr/share/icons/hicolor/256x256/apps/` 或应用目录下。

## Electron 配置

在 Electron 的 `electron-builder.yml` 中指定图标路径：

```yaml
win:
  icon: build/icon.ico
mac:
  icon: build/icon.icns
linux:
  icon: build/icon.png
```

> **注意**：`.ico`、`.icns`、`.png` 文件不纳入版本管理。仅 `icon.svg` 作为源文件追踪。各平台的最终图标文件需在打包前按上述步骤生成。
