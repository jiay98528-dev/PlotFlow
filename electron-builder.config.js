/**
 * electron-builder 三平台打包配置 (M7-01)
 *
 * 构建流程:
 *   electron-vite build  → 输出到 out/
 *   electron-builder     → 从 out/ 读取并打包到 release/
 *
 * 注意: V0.1 不配置代码签名, Windows SmartScreen 警告属正常现象。
 */

module.exports = {
  appId: 'com.plotflow.app',
  productName: 'PlotFlow',

  directories: {
    output: 'release',
    buildResources: 'build',
  },

  /* ── 打包内容 ── */
  files: [
    'out/**/*',
    'package.json',
  ],

  /* ── Windows ── */
  win: {
    target: ['nsis'],
    icon: 'build/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },

  /* ── macOS ── */
  mac: {
    target: ['dmg'],
    icon: 'build/icon.icns',
    category: 'public.app-category.developer-tools',
  },

  /* ── Linux ── */
  linux: {
    target: ['AppImage', 'deb'],
    icon: 'build/icon.png',
    category: 'Development',
  },
};
