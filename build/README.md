# 品牌与安装资源

> 文档导航：[交互、主题与视觉索引](../doc/indexes/design.md) · [总索引](../doc/INDEX.md)

## 当前打包源图

- [应用图标源图](source-crops/app-final-1-source.png)
- [故事文件图标源图](source-crops/file-final-3-source.png)
- [安装器侧栏源图](source-crops/installer-sidebar-source.png)

这些源图由 [generate-icons.py](../scripts/generate-icons.py) 生成平台图标和侧栏资源；不要把未采用的草稿当作生产源图。

## 生成资源

应用使用 icon.ico / icon.icns / icon.png 和 app-icons 中的各尺寸 PNG；文件关联使用 file-icon.ico，其他平台图标位于 file-icons。安装侧栏使用 installer-sidebar.bmp 和 uninstaller-sidebar.bmp。

实际引用由 [electron-builder.config.js](../electron-builder.config.js) 与 [installer.nsh](installer.nsh) 决定。维护图标时同步必要的平台格式，不更改应用 ID、安装 GUID 或用户数据兼容目录。

应用 Home 和官网当前使用各自目录中的 fablevia-icon.svg，与打包位图的视觉统一属于 [官网设计基线](../website/DESIGN_BASELINE.md) 中尚待决定的方向；这些在用 SVG 不属于临时资产。
