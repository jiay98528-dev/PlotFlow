# PlotFlow 图标资源

当前生产资源基于用户确认的最终拼板图直接裁切生成。

## 当前源文件

- 应用图标源图：`build/source-crops/app-final-1-source.png`
- `.mdstory` 文件图标源图：`build/source-crops/file-final-2-source.png`

## 导出结果

- 应用图标：
  - `build/icon.ico`
  - `build/icon.icns`
  - `build/icon.png`
  - `build/app-icons/icon-{1024,512,256,128,64,32,16}.png`
- 文件关联图标：
  - `build/file-icon.ico`
  - `build/file-icon.icns`
  - `build/file-icon.png`
  - `build/file-icons/file-icon-{1024,512,256,128,64,32,16}.png`

## 说明

- `electron-builder` 当前使用 `build/icon.*` 作为应用图标
- `.mdstory` 文件关联使用 `build/file-icon.ico`
- `icon.svg` 和 `file-icon.svg` 仅保留为历史草稿，不作为当前生产源文件
