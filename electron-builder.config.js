/**
 * Electron Builder packaging configuration.
 *
 * `website/` is a separately deployed documentation site and must never be
 * bundled into the desktop app. Keep `files` as an allowlist.
 */

module.exports = {
  appId: 'com.plotflow.app',
  productName: 'Fablevia',

  directories: {
    output: 'release',
    buildResources: 'build',
  },

  electronDownload: {
    mirror: 'https://npmmirror.com/mirrors/electron/',
  },

  npmRebuild: false,
  asar: true,

  files: [
    'out/**/*',
    'package.json',
  ],

  extraResources: [
    {
      from: 'build/icon.png',
      to: 'icon.png',
    },
    {
      from: 'build/file-icon.ico',
      to: 'file-icon.ico',
    },
  ],

  fileAssociations: [
    {
      ext: 'mdstory',
      name: 'Fablevia.Story',
      description: 'Fablevia Story',
      icon: 'build/file-icon.ico',
      role: 'Editor',
      isPackage: false,
    },
  ],

  win: {
    target: ['nsis'],
    icon: 'build/icon.ico',
  },

  nsis: {
    oneClick: false,
    artifactName: 'Fablevia Setup ${version}.${ext}',
    guid: '74fc8b73-b58d-5573-82e7-75efc9ec526f',
    include: 'build/installer.nsh',

    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    // Windows NSIS file associations are only reliable for per-machine installs.
    perMachine: true,
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
    runAfterFinish: true,
    shortcutName: 'Fablevia',
    uninstallDisplayName: 'Fablevia',

    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    installerSidebar: 'build/installer-sidebar.bmp',
    uninstallerSidebar: 'build/uninstaller-sidebar.bmp',

    multiLanguageInstaller: true,
    displayLanguageSelector: true,
    installerLanguages: ['zh_CN', 'zh_TW', 'en_US', 'ja_JP', 'ko_KR'],
  },

  mac: {
    target: ['dmg'],
    icon: 'build/icon.icns',
    category: 'public.app-category.developer-tools',
  },

  linux: {
    target: ['AppImage', 'deb'],
    icon: 'build/icon.png',
    category: 'Development',
  },
};
