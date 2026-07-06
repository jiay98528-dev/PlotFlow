# PlotFlow 鎶€鏈灦鏋勮璁?(TAD)

> **主题架构权威口径（2026-06-27）**：主题系统只服务官方主题。内置官方主题随应用编译发布；官方远程免费主题通过 `website/public/data/official-themes.json` 注册，下载 `.pf-official-theme.zip` 后由 Electron 主进程执行 `sha256` 校验、路径安全校验和 manifest 校验，再通过 `plotflow-theme://` 动态加载包内 `index.mjs`。远程包与内置主题拥有同等当前主题能力：`ThemeDescriptor`、React `surfaces`、React `slots`、tokens、layout/UX recipes、Monaco 配色、CSS 和 assets。第三方上传、社区主题、本地 `.pf-theme.zip` 导入、支付和授权均不属于当前架构。完整开发标准见 `doc/standards-theme-development.md`。

> **V0.3 外审架构补充（2026-07-06）**：以下合同覆盖本文旧段落中相冲突的内容。Home `Continue editing` 必须通过最近文件路径和文件 IPC 重新读盘；Graph Lab 写回必须基于 source offset edit 和共享 source analysis；Graph Lab Source Drawer 只编辑当前 H1 章节切片并映射回完整 `.mdstory`；frontmatter `vars:` 是 app 模式单文件全局变量源；`下一步: 节点：X` 是独立于 `[选项]` 的节点级流程边，JSON schema v0.1 导出时投影为无条件合成 option；W007 表示包含选项边和 `下一步` 边的无外部出口 SCC 闭环风险，旧版 “IncompleteOptionDetector” 语义已废弃；章节标签栏必须是可见命令栏行并有截图 E2E 证据。


**鐗堟湰**锛歏0.1 | **鏃ユ湡**锛?026-06-10 | **鐘舵€?*锛歁VP 瀹炵幇钃濆浘

---

## 1. 鏋舵瀯鎬昏

### 1.1 涓夊眰鏋舵瀯鍥?
```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?                   Electron Main Process                         鈹?鈹?                                                                 鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹? 鈹?FileService  鈹? 鈹?AutoSaver    鈹? 鈹?NativeMenuBuilder     鈹? 鈹?鈹? 鈹?             鈹? 鈹?             鈹? 鈹?                      鈹? 鈹?鈹? 鈹?read(path)   鈹? 鈹?debounce     鈹? 鈹?buildTemplateMenu()   鈹? 鈹?鈹? 鈹?write(path,  鈹? 鈹?(500ms)      鈹? 鈹?buildEditMenu()       鈹? 鈹?鈹? 鈹?  content)   鈹? 鈹?queue        鈹? 鈹?buildHelpMenu()       鈹? 鈹?鈹? 鈹?watch(path)  鈹? 鈹?flush()      鈹? 鈹?registerShortcuts()   鈹? 鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹?        鈹?                鈹?                     鈹?              鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹? 鈹?                   IPC Bridge (contextBridge)              鈹? 鈹?鈹? 鈹? exposeInMainWorld('plotflow', { file, menu, dialog, ...})鈹? 鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹溾攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?  Electron Renderer Process 鈹?                                 鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹? 鈹?              UI Layer (React 18 + TypeScript 5)          鈹? 鈹?鈹? 鈹?                                                          鈹? 鈹?鈹? 鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?  鈹? 鈹?鈹? 鈹? 鈹?AppShell 鈹? 鈹? LeftPanel   鈹? 鈹?  RightPanel     鈹?  鈹? 鈹?鈹? 鈹? 鈹?         鈹? 鈹?(OutlineView)鈹? 鈹?(ReactFlowGraph) 鈹?  鈹? 鈹?鈹? 鈹? 鈹?TopBar   鈹? 鈹?             鈹? 鈹?                 鈹?  鈹? 鈹?鈹? 鈹? 鈹?StatusBar鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?  鈹? 鈹?鈹? 鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?        鈹?                  鈹?             鈹? 鈹?鈹? 鈹?                      鈻?                  鈻?             鈹? 鈹?鈹? 鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹? 鈹?鈹? 鈹? 鈹?           CenterPanel                             鈹? 鈹? 鈹?鈹? 鈹? 鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹? 鈹? 鈹?鈹? 鈹? 鈹? 鈹?  MonacoEditor          鈹? 鈹?CompletionGhost鈹? 鈹? 鈹? 鈹?鈹? 鈹? 鈹? 鈹?  (code-editor)         鈹? 鈹?Text (overlay) 鈹? 鈹? 鈹? 鈹?鈹? 鈹? 鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹? 鈹? 鈹?鈹? 鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹? 鈹?鈹? 鈹?                                                          鈹? 鈹?鈹? 鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹? 鈹?鈹? 鈹? 鈹?    鐘舵€佺鐞?(Zustand Stores)                       鈹? 鈹? 鈹?鈹? 鈹? 鈹? useStoryStore  useEditorStore  useGraphStore      鈹? 鈹? 鈹?鈹? 鈹? 鈹? useValidatorStore  useCompletionStore  useThemeStore鈹? 鈹? 鈹?鈹? 鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹? 鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹?                            鈹?                                  鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹? 鈹?           Core Layer (Pure TypeScript 鈥?闆?UI 渚濊禆)      鈹? 鈹?鈹? 鈹?                                                          鈹? 鈹?鈹? 鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? 鈹?鈹? 鈹? 鈹?Parser   鈹? 鈹俈alidator 鈹? 鈹侲xporter  鈹? 鈹侰ompletion鈹?鈹? 鈹?鈹? 鈹? 鈹?         鈹? 鈹?         鈹? 鈹?         鈹? 鈹?Engine   鈹?鈹? 鈹?鈹? 鈹? 鈹斺攢鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹?鈹? 鈹?鈹? 鈹?      鈹?            鈹?            鈹?            鈹?       鈹? 鈹?鈹? 鈹? 鈹屸攢鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹?  鈹? 鈹?鈹? 鈹? 鈹?        PlotFlowData AST (涓棿琛ㄧず)                鈹?  鈹? 鈹?鈹? 鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?  鈹? 鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

### 1.2 閮ㄧ讲鐭╅樀

| 妯″紡 | 杩愯鐜 | 鍏ュ彛 | 鏂囦欢璇诲啓 | 鍙橀噺鏉ユ簮 | 閫傜敤鍦烘櫙 |
|------|---------|------|---------|---------|---------|
| **Web 寮€鍙戞ā寮?* | Vite Dev Server (localhost:5173) | `index.html` | 娴忚鍣?File System Access API锛堝疄楠屾€э級 / Mock FileService | 鏈湴寮€鍙?璋冭瘯 |
| **妗岄潰鎵撳寘妯″紡** | Electron 42 鐙珛绐楀彛 | `packages/app/src-electron/main.ts` | Node.js `fs` 妯″潡锛堥€氳繃 IPC锛?| 鐢熶骇鍙戝竷 |
| **鎻掍欢妯″紡 (Godot)** | Godot 缂栬緫鍣?Dock 鍐呭祵 WebView | Godot 鎻掍欢瑙﹀彂鍚姩 | 寮曟搸椤圭洰鐩綍鍐欏叆 | 浠?Godot 寮曟搸鍚屾鍙橀噺 | 寮曟搸娣卞害鏁村悎 |
| **鎻掍欢妯″紡 (Unity)** | Unity 缂栬緫鍣ㄧ獥鍙?| Unity 鎻掍欢瑙﹀彂 | 寮曟搸椤圭洰鐩綍鍐欏叆 | 浠?Unity 寮曟搸鍚屾 | V0.2 瀹屾暣瀹炵幇 |
| **鎻掍欢妯″紡 (Unreal)** | Unreal 缂栬緫鍣ㄩ潰鏉?| 鎺ュ彛瀹氫箟锛圴0.1 鏃犺繍琛岋級 | 鈥?| 鈥?| V0.3 瀹屾暣瀹炵幇 |

### 1.3 鍏抽敭涓嶅彲鍙樺喅绛?
| # | 鍐崇瓥 | 绾︽潫鍔?| 璇存槑 |
|---|------|--------|------|
| D-IMM-01 | **鏂囦欢鍗虫暟鎹簮** | 缁濆 | `.mdstory` 鏄敮涓€鏁版嵁婧愩€傜粷涓嶅紩鍏ユ暟鎹簱锛圫QLite/IndexedDB锛夊瓨鍌ㄨ剼鏈唴瀹广€傚彧鑳界敤浜庡瓨鍌ㄥ厓鏁版嵁锛堣鏂欑储寮曘€佺敤鎴峰亸濂斤級銆?|
| D-IMM-02 | **鍙屾姇褰卞悓姝?* | 缁濆 | `.mdstory` 鏄敮涓€纾佺洏鐪熺浉婧愶紱GUI 涓庢簮鏂囨湰鏄悓涓€鏁呬簨鏁版嵁鐨勪袱涓紪杈戞姇褰便€傚浘褰㈠寲淇敼蹇呴』閫氳繃鍛戒护灞傚簭鍒楀寲鍥?`.mdstory`锛屾簮鏂囨湰淇敼蹇呴』閲嶆柊瑙ｆ瀽骞跺悓姝?GUI銆?|
| D-IMM-03 | **绂荤嚎浼樺厛** | 缁濆 | 闆剁綉缁滀緷璧栥€傛湰鍦拌繍琛岋紝鏈湴琛ュ叏锛屾湰鍦板鍑恒€俈0.3 涔嬪墠涓嶈€冭檻浠讳綍浜戠鍔熻兘銆?|
| D-IMM-04 | **琛ュ叏闅愮瀹夊叏** | 缁濆 | N-gram 缁熻妯″瀷锛屾暟鎹笉绂诲紑鏈湴杩涚▼銆備笉涓婁紶銆佷笉鏀堕泦銆佷笉鑱旂綉銆?|
| D-IMM-05 | **鎻掍欢妯″紡鍙橀噺鐢卞紩鎿庡畾涔?* | 鏉′欢 | 浠?Godot/Unity 鍚姩鏃讹紝缂栬緫鍣ㄥ彉閲忎粠寮曟搸鍚屾锛屼笉鍙嚜鐢卞垱寤烘柊鍙橀噺銆傜嫭绔嬫ā寮忎笅涓嶅彈姝ら檺鍒躲€?|
| D-IMM-06 | **Electron锛堥潪 Tauri锛?* | V0.3 閿佸畾 | Electron 42+锛屽鐢ㄧ幇鏈夌紪杈戝櫒璧勪骇锛孧onaco Editor 瀹樻柟鏀寔銆俆auri 浣滀负鍚庣画杩佺Щ璇勪及椤广€?|
| D-IMM-07 | **Monarch Tokenizer锛堥潪 TextMate锛?* | 缁濆 | Monaco 璇硶楂樹寒閫氳繃 Monarch 澹版槑寮?tokenizer 瀹炵幇銆俆extMate 璇硶浣滀负鍙€夌殑澧炲己锛圴0.2+锛夈€?|
| D-IMM-08 | **Design Token 寮哄埗** | 缁濆 | 鎵€鏈夌粍浠堕鑹插繀椤诲紩鐢?CSS 鍙橀噺 Design Token锛岀姝㈣８ hex 鑹插€硷紙`#fff`銆乣#eee` 绛夛級銆備富棰樺垏鎹㈤€氳繃 CSS 鍙橀噺椹卞姩銆?|
| D-IMM-09 | **瀹樻柟涓婚妯″潡杈圭晫** | 缁濆 | 褰撳墠鍙彂琛岀紪璇戝唴缃畼鏂逛富棰樸€傚畼鏂逛富棰樺彲鏇挎崲鍙楁帶 React slots銆丏esign Token銆丮onaco 涓婚銆佸竷灞€閰嶆柟鍜屽姩鏁堬紱绀惧尯涓婚銆佹湰鍦?`.pf-theme.zip` 瀵煎叆鍜岃繙绋嬩笅杞芥殏涓嶄綔涓轰骇鍝佸叆鍙ｃ€?|

---

### 1.4 Graph Lab Core 鍙屾姇褰辨灦鏋?
Graph Lab 鏄?V0.3 鍥句紭鍏堟寮忓伐浣滃尯銆傚畠鎶?GUI 鎿嶄綔鎻愬崌涓轰富缂栬緫鍏ュ彛锛屼絾涓嶅紩鍏ユ暟鎹簱銆佷笓鏈変簩杩涘埗宸ョ▼鏂囦欢鎴栫嫭绔嬪浘瀛樺偍銆俙.mdstory` 浠嶆槸鍞竴纾佺洏鏍煎紡锛涗负淇濆瓨鎵嬪姩鑺傜偣鍧愭爣锛孎rontmatter 鍏佽涓€涓吋瀹规棫鏂囦欢鐨勫彲閫?`layout.graph.nodes` 鎶曞奖鍧椼€?
```
Graph Lab GUI command
    鈹?    鈻?graphEditService锛堣妭鐐?閫夐」/鏉′欢/鏁堟灉鍛戒护灞傦級
    鈹? 鐢熸垚鏈€灏忔枃鏈?patch 鎴?AST-safe 鏂囨湰閲嶅啓
    鈻?useEditorStore.content锛?mdstory 婧愭枃鏈姇褰憋級
    鈹?    鈻?parsePipeline锛圥arser 鈫?Validator 鈫?Graph adapter锛?    鈹?    鈹溾攢鈹€ useGraphStore.nodes/edges锛圙UI 鎶曞奖锛?    鈹溾攢鈹€ useEditorStore.diagnostics锛堣瘖鏂姇褰憋級
    鈹斺攢鈹€ Exporter锛圝SON/HTML/TXT锛?```

| 绾︽潫 | 璇存槑 |
|------|------|
| 鍗曚竴鎸佷箙鍖栨牸寮?| 鍙啓 `.mdstory`锛屼笉鍒涘缓闅愯棌鍥炬暟鎹簱鎴栦笓鏈夊伐绋嬫枃浠?|
| 鍛戒护灞傞殧绂?| Graph Lab 涓嶇洿鎺ヤ慨鏀?React Flow store锛涘繀椤荤粡 `graphEditService` 鐢熸垚鍙洖鏀俱€佸彲娴嬭瘯鐨勬晠浜嬬紪杈戝懡浠?|
| 甯冨眬鎶曞奖鍙€?| M8 浠呮柊澧炲吋瀹规棫鏂囦欢鐨?`layout.graph.nodes` 鍙€夊潡锛涚己澶辨椂缁х画浣跨敤 Dagre 鑷姩甯冨眬 |
| 鍙屽悜鍙仮澶?| 浠?Graph Lab 鍒囧洖 split 鏃?Monaco 蹇呴』鏄剧ず鏈€鏂版簮鏂囨湰锛涙墜鏀规簮鏂囨湰鍚?Graph Lab 蹇呴』閲嶆柊瑙ｆ瀽骞舵仮澶嶅浘鐘舵€?|
| DOM 鏂█淇濈暀 | E2E 涓嶈兘鍙 Zustand store锛涘浘鐘舵€佷粛闇€楠岃瘉 React Flow DOM class锛岄伩鍏嶉仐婕忔覆鏌撳眰鏁呴殰 |

---

### 1.5 Official Theme 缂栬瘧鍐呯疆鐑彃鎷旀灦鏋?
Official Theme 鏄?PlotFlow 鐨勫畼鏂圭編瀛﹀拰 UX 澶栬妯″潡锛屼笉鏄笟鍔℃彃浠剁郴缁熴€傚綋鍓嶅彧鍙戣闅忓簲鐢ㄧ紪璇戞墦鍖呯殑瀹樻柟涓婚锛涘畠鍙互娣卞害鏇挎崲 Graph Lab 鍜?Split 鐨勮瑙?slots锛屼絾涓嶅緱鏀瑰彉 `.mdstory` 璇箟銆佸鍑虹粨鏋溿€佷繚瀛樻祦绋嬫垨 Graph Lab 鍛戒护灞傘€?
```
OfficialThemeDefinition
    鈹?    鈻?OfficialThemeProvider
    鈹溾攢鈹€ html[data-official-theme]
    鈹溾攢鈹€ html[data-theme-pack]锛堝巻鍙插吋瀹癸級
    鈹溾攢鈹€ CSS Design Token 娉ㄥ叆
    鈹溾攢鈹€ Monaco defineTheme
    鈹溾攢鈹€ Graph Lab layoutRecipe / motionRecipe
    鈹斺攢鈹€ OfficialThemeSlots
        鈹溾攢鈹€ StoryNodeCard
        鈹溾攢鈹€ StoryEdge
        鈹溾攢鈹€ ThemePreview
        鈹斺攢鈹€ HomePreview
```

| 灞傜骇 | 鍏佽鑳藉姏 | 绂佹鑳藉姏 |
|------|----------|----------|
| Tokens | 棰滆壊銆佸瓧浣撱€佸渾瑙掋€侀槾褰便€佺姸鎬佽壊銆佸姩鏁堟椂闀?| 鏀瑰啓涓氬姟鐘舵€併€侀殣钘忓叧閿寜閽?|
| Visual Slots | 瀹樻柟缂栬瘧鍐呯疆鑺傜偣銆佺嚎缂嗐€佺鍙ｃ€侀潰鏉裤€侀瑙堢粍浠?| 杩愯鏃跺姞杞界涓夋柟 JS/React |
| Layout Recipe | Graph Lab 闈㈡澘瀹藉害銆丼ource Dock 浣嶇疆銆佽妭鐐瑰崱鐗囪瑙夋牱寮忋€佸瘑搴?| 缁曡繃 `graphEditService` 鎴栧垱寤虹浜屾暟鎹簮 |
| Store Metadata | 瀹樻柟涓婚 ID銆佺増鏈€佸敭鍗栧叆鍙ｃ€佸唴缃?鍟嗗簵鐘舵€?| 搴旂敤鍐呮敮浠樸€佹巿鏉冦€佽繙绋嬩笅杞?|

棣栫増瀹炵幇 `鍙欎簨宸ヤ綔鍙癭 涓?`澶滆埅钃濆浘` 涓や釜瀹樻柟涓婚銆丠omeSurface 涓婚妯″潡銆乀hemeCenter 鍜屽畼缃戜富棰樺睍绀恒€傝喘涔板叆鍙ｅ彧璺宠浆瀹樼綉/鍟嗗簵 URL锛涚ぞ鍖轰富棰樸€佹湰鍦板鍏ャ€佽繙绋嬬储寮曘€佺鍚嶃€佷笅杞藉拰鎺堟潈鍚庣画鍙︾珛闃舵銆?
---

## 2. 鍓嶇鏋舵瀯 (Renderer Process) `[V0.1]`

### 2.1 缁勪欢鏍?
```
AppShell
鈹溾攢鈹€ TitleBar (鑷畾涔夌獥鍙ｆ爣棰樻爮锛學indows 鏃犺竟妗嗘ā寮?
鈹?  鈹溾攢鈹€ AppLogo
鈹?  鈹溾攢鈹€ WindowControls (鏈€灏忓寲/鏈€澶у寲/鍏抽棴)
鈹?  鈹斺攢鈹€ FileIndicator (褰撳墠鏂囦欢鍚?+ 淇敼鏍囪 鈼?
鈹?鈹溾攢鈹€ MenuBar (Electron 鍘熺敓鑿滃崟锛宮acOS 缃《锛學indows/Linux 鍐呭祵)
鈹?  鈹溾攢鈹€ FileMenu (鏂板缓/鎵撳紑/淇濆瓨/鍙﹀瓨涓?鏈€杩戞枃浠?
鈹?  鈹溾攢鈹€ EditMenu (鎾ら攢/閲嶅仛/鏌ユ壘/鏇挎崲/璺宠浆鑺傜偣)
鈹?  鈹溾攢鈹€ ViewMenu (澶х翰瑙嗗浘/鍒嗘敮鍥?闂闈㈡澘 鏄鹃殣鍒囨崲)
鈹?  鈹溾攢鈹€ ExportMenu (JSON/HTML/TXT/寮曟搸鎻掍欢)
鈹?  鈹斺攢鈹€ HelpMenu (璇硶鎵嬪唽/妯℃澘鎸囧崡/鍙嶉/鍏充簬)
鈹?鈹溾攢鈹€ Toolbar
鈹?  鈹溾攢鈹€ NewFileButton
鈹?  鈹溾攢鈹€ OpenFileButton
鈹?  鈹溾攢鈹€ SaveButton (鍚繚瀛樼姸鎬佹寚绀?
鈹?  鈹溾攢鈹€ ExportDropdown
鈹?  鈹溾攢鈹€ Separator
鈹?  鈹溾攢鈹€ InsertNodeButton (Ctrl+Shift+N)
鈹?  鈹溾攢鈹€ InsertOptionButton (Ctrl+Shift+O)
鈹?  鈹溾攢鈹€ OpenConditionEditorButton (Ctrl+Shift+C)
鈹?  鈹溾攢鈹€ Separator
鈹?  鈹溾攢鈹€ UndoButton / RedoButton
鈹?  鈹溾攢鈹€ ThemeToggleButton (Ctrl+Shift+T, 鏆楄壊/浜壊)
鈹?  鈹斺攢鈹€ SearchButton (Ctrl+F)
鈹?鈹溾攢鈹€ LayoutContainer (鍙嫋鎷藉垎闅旀潯鐨勪笁鏍忓竷灞€)
鈹?  鈹溾攢鈹€ LeftPanel (鍙姌鍙? 榛樿瀹藉害 200px, 鏈€灏?120px, 鏈€澶?400px)
鈹?  鈹?  鈹斺攢鈹€ OutlineView
鈹?  鈹?      鈹溾攢鈹€ OutlineSearchBar (鑺傜偣/绔犺妭杩囨护)
鈹?  鈹?      鈹溾攢鈹€ OutlineTree (閫掑綊娓叉煋)
鈹?  鈹?      鈹?  鈹斺攢鈹€ OutlineNode (姣忎釜绔犺妭/鑺傜偣锛屽惈鐘舵€佸浘鏍?
鈹?  鈹?      鈹?      鈹溾攢鈹€ ChapterNode (H1, 鍙姌鍙?
鈹?  鈹?      鈹?      鈹溾攢鈹€ StoryNodeItem (H2, 鍙偣鍑昏烦杞?
鈹?  鈹?      鈹?      鈹斺攢鈹€ DiagnosticBadge (閿欒/璀﹀憡/寤鸿璁℃暟)
鈹?  鈹?      鈹斺攢鈹€ OutlineToolbar (鍏ㄩ儴灞曞紑/鎶樺彔)
鈹?  鈹?鈹?  鈹溾攢鈹€ CenterPanel (寮规€у搴? 鍗犲墿浣?60%, 鏈€灏?300px)
鈹?  鈹?  鈹溾攢鈹€ MonacoEditor
鈹?  鈹?  鈹?  鈹溾攢鈹€ EditorContainer (Monaco 鎸傝浇鐐?
鈹?  鈹?  鈹?  鈹溾攢鈹€ MonarchTokensProvider (璇硶楂樹寒鎻愪緵鑰?
鈹?  鈹?  鈹?  鈹溾攢鈹€ InlineCompletionProvider (骞界伒琛ュ叏鎻愪緵鑰?
鈹?  鈹?  鈹?  鈹溾攢鈹€ DiagnosticMarkers (setModelMarkers 娉ㄥ叆)
鈹?  鈹?  鈹?  鈹溾攢鈹€ FoldingProvider (鑺傜偣鍧楁姌鍙?
鈹?  鈹?  鈹?  鈹斺攢鈹€ HoverProvider (璇婃柇淇℃伅 tooltip)
鈹?  鈹?  鈹溾攢鈹€ CompletionGhostText (Monaco overlay, 骞界伒瀛楃娓叉煋)
鈹?  鈹?  鈹斺攢鈹€ ConditionEditorPanel (鍐呰仈寮瑰嚭, 缁濆瀹氫綅)
鈹?  鈹?      鈹溾攢鈹€ ConditionRow (鍗曟潯鏉′欢)
鈹?  鈹?      鈹?  鈹溾攢鈹€ VariableDropdown
鈹?  鈹?      鈹?  鈹溾攢鈹€ OperatorDropdown
鈹?  鈹?      鈹?  鈹斺攢鈹€ ValueInput
鈹?  鈹?      鈹溾攢鈹€ LogicToggle (AND / OR 鍒囨崲鎸夐挳)
鈹?  鈹?      鈹溾攢鈹€ AddConditionGroupButton
鈹?  鈹?      鈹溾攢鈹€ ExpressionPreview
鈹?  鈹?      鈹斺攢鈹€ ActionButtons (搴旂敤 / 鍙栨秷)
鈹?  鈹?鈹?  鈹斺攢鈹€ RightPanel (寮规€у搴? 鍗犲墿浣?40%, 鏈€灏?250px)
鈹?      鈹斺攢鈹€ ReactFlowGraph
鈹?          鈹溾攢鈹€ ReactFlowProvider (React Flow 涓婁笅鏂?
鈹?          鈹溾攢鈹€ ReactFlowCanvas
鈹?          鈹?  鈹溾攢鈹€ StoryNode (鑷畾涔夎妭鐐圭粍浠?
鈹?          鈹?  鈹?  鈹溾攢鈹€ NodeStatusIndicator (褰╄壊鍦嗙偣)
鈹?          鈹?  鈹?  鈹溾攢鈹€ NodeTitle (鑺傜偣鏍囬)
鈹?          鈹?  鈹?  鈹溾攢鈹€ NodePreview (鍓?0瀛楁憳瑕?
鈹?          鈹?  鈹?  鈹斺攢鈹€ OptionCountBadge (閫夐」鏁伴噺寰界珷)
鈹?          鈹?  鈹溾攢鈹€ ConditionEdge (鏉′欢杩炵嚎: 铏氱嚎鏍峰紡)
鈹?          鈹?  鈹斺攢鈹€ UnconditionalEdge (鏃犳潯浠惰繛绾? 瀹炵嚎鏍峰紡)
鈹?          鈹溾攢鈹€ Minimap (鍙充笅瑙掑皬鍦板浘)
鈹?          鈹溾攢鈹€ Controls (缂╂斁/閫傚簲/閿佸畾)
鈹?          鈹斺攢鈹€ Background (缃戞牸鑳屾櫙)
鈹?鈹溾攢鈹€ ProblemsPanel (搴曢儴鍙垏鎹㈤潰鏉? Ctrl+Shift+M)
鈹?  鈹溾攢鈹€ ProblemsToolbar (鎸変弗閲嶅害绛涢€? 閿欒/璀﹀憡/寤鸿)
鈹?  鈹斺攢鈹€ ProblemsList
鈹?      鈹斺攢鈹€ ProblemItem (鍥炬爣 + 缂栧彿 + 鎻忚堪 + 鏂囦欢浣嶇疆 + 淇寤鸿鎸夐挳)
鈹?鈹斺攢鈹€ StatusBar
    鈹溾攢鈹€ SaveStatus (鉁?宸蹭繚瀛?/ 鈴?淇濆瓨涓?/ 鈼?鏈繚瀛?
    鈹溾攢鈹€ NodeStats (12鑺傜偣 / 28閫夐」)
    鈹溾攢鈹€ DiagnosticSummary (馃敶3 馃煛2 馃數1)
    鈹溾攢鈹€ CursorPosition (琛?鍒?
    鈹溾攢鈹€ ZoomLevel (100%)
    鈹斺攢鈹€ LanguageSelector (涓枃 / English)
```

### 2.1.1 鍏抽敭缁勪欢 Props 鎺ュ彛

```typescript
// AppShell 鈥?鏍圭粍浠? 鏃?props, 閫氳繃 stores 鑾峰彇鍏ㄥ眬鐘舵€?interface AppShellProps {} // 鏃?props, 鍐呴儴娑堣垂 stores

// LayoutContainer 鈥?涓夋爮鍙嫋鎷藉竷灞€
interface LayoutContainerProps {
  defaultLeftWidth: number;      // 榛樿 200
  minLeftWidth: number;          // 鏈€灏?120
  maxLeftWidth: number;          // 鏈€澶?400
  centerRatio: number;           // 涓爮鍗犳瘮 0.6
  minCenterWidth: number;        // 鏈€灏?300
  minRightWidth: number;         // 鏈€灏?250
}

// OutlineView 鈥?澶х翰瑙嗗浘闈㈡澘
interface OutlineViewProps {
  chapters: Chapter[];                              // from useStoryStore
  activeNodeId: string | null;                      // from useEditorStore
  diagnosticCounts: Map<string, DiagnosticCounts>;  // from useValidatorStore
  onNodeClick: (fullId: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

// MonacoEditor 鈥?缂栬緫鍣ㄤ富缁勪欢
interface MonacoEditorProps {
  initialValue: string;             // 鏂囦欢鍐呭
  language: string;                 // 'plotflow'
  theme: 'plotflow-dark' | 'plotflow-light';  // from useThemeStore
  diagnostics: Diagnostic[];        // from useValidatorStore
  completions: InlineCompletion[];  // from useCompletionStore
  onContentChange: (content: string) => void;   // 鈫?useEditorStore
  onCursorMove: (position: Position) => void;   // 鈫?useEditorStore
  onNodeFocused: (nodeId: string) => void;       // 鈫?useGraphStore
}

// ReactFlowGraph 鈥?鍒嗘敮鍙鍖栧浘
interface ReactFlowGraphProps {
  nodes: StoryFlowNode[];           // from useGraphStore (React Flow 鏍煎紡)
  edges: StoryFlowEdge[];           // from useGraphStore (React Flow 鏍煎紡)
  onNodeClick: (nodeId: string) => void;        // 鈫?scroll editor
  onEdgeUpdate: (edgeId: string, newTarget: string) => void;  // 鈫?modify AST
  onLayoutReset: () => void;                     // Dagre 閲嶆帓
  theme: 'dark' | 'light';          // from useThemeStore
}

// StoryNode (React Flow 鑷畾涔夎妭鐐?
interface StoryNodeProps extends NodeProps {
  data: {
    id: string;
    title: string;
    preview: string;               // 鍓?0瀛?    optionCount: number;
    status: NodeStatus;            // 'normal' | 'orphan' | 'deadend' | 'error' | 'selected'
    isRoot: boolean;
    onClick: (id: string) => void;
    onDoubleClick: (id: string) => void;
  };
}

// ConditionEdge (React Flow 鑷畾涔夎竟)
interface ConditionEdgeProps extends EdgeProps {
  data: {
    isConditional: boolean;         // true = 铏氱嚎, false = 瀹炵嚎
    conditionText?: string;
  };
}

// ConditionEditorPanel 鈥?鍐呰仈鏉′欢缂栬緫鍣?interface ConditionEditorPanelProps {
  optionIndex: number;              // 褰撳墠缂栬緫鐨勯€夐」绱㈠紩
  nodeId: string;                   // 鎵€灞炶妭鐐?  initialConditions: Condition | null;
  variables: VariableDefinition[];  // from useStoryStore (Frontmatter)
  engineVariables?: string[];       // from plugin mode
  position: { top: number; left: number };  // 寮瑰嚭浣嶇疆
  onApply: (conditions: Condition | null) => void;
  onCancel: () => void;
}

// CompletionGhostText 鈥?骞界伒鏂囨湰瑕嗙洊灞?interface CompletionGhostTextProps {
  text: string;                     // 琛ュ叏鏂囨湰
  position: Position;               // 鍏夋爣浣嶇疆
  visible: boolean;
}
```

### 2.2 鐘舵€佺鐞?
#### 2.2.1 Zustand Store 鏋舵瀯

```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?                   Zustand Store 灞?                     鈹?鈹?                                                        鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?         鈹?鈹? 鈹? useStoryStore   鈹?   鈹? useEditorStore  鈹?         鈹?鈹? 鈹?                 鈹?   鈹?                 鈹?         鈹?鈹? 鈹?plotFlowData     鈹傗梽鈹€鈹€鈻衡攤 rawMarkdown      鈹?         鈹?鈹? 鈹?variables        鈹?   鈹?cursorPosition   鈹?         鈹?鈹? 鈹?chapters[]       鈹?   鈹?activeNodeId     鈹?         鈹?鈹? 鈹?setPlotFlowData()鈹?   鈹?isDirty          鈹?         鈹?鈹? 鈹?updateVariable() 鈹?   鈹?selections[]     鈹?         鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?         鈹?鈹?         鈹?                       鈹?                    鈹?鈹?         鈹?   鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?         鈹?鈹?         鈹?   鈹?                  鈻?         鈹?         鈹?鈹?         鈹?   鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?  鈹?         鈹?鈹?         鈹?   鈹? 鈹?  useGraphStore      鈹?  鈹?         鈹?鈹?         鈹?   鈹? 鈹?                     鈹?  鈹?         鈹?鈹?         鈹?   鈹? 鈹? nodes: StoryFlowNode[]  鈹?         鈹?鈹?         鈹?   鈹? 鈹? edges: StoryFlowEdge[]  鈹?         鈹?鈹?         鈹?   鈹? 鈹? selectedNodeId      鈹?  鈹?         鈹?鈹?         鈹?   鈹? 鈹? viewport: Viewport   鈹?  鈹?         鈹?鈹?         鈹?   鈹? 鈹? syncFromAST()        鈹?  鈹?         鈹?鈹?         鈹?   鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?  鈹?         鈹?鈹?         鈹?   鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?         鈹?鈹?         鈹?                       鈹?                    鈹?鈹?         鈻?                       鈻?                    鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?         鈹?鈹? 鈹倁seValidatorStore 鈹?   鈹倁seCompletionStore鈹?         鈹?鈹? 鈹?                 鈹?   鈹?                 鈹?         鈹?鈹? 鈹?diagnostics[]    鈹?   鈹?currentSuggestion鈹?         鈹?鈹? 鈹?errorCount       鈹?   鈹?candidates[]     鈹?         鈹?鈹? 鈹?warningCount     鈹?   鈹?isComputing      鈹?         鈹?鈹? 鈹?infoCount        鈹?   鈹?triggerContext   鈹?         鈹?鈹? 鈹?validate()       鈹?   鈹?requestCompletion鈹?         鈹?鈹? 鈹?clearForNode()   鈹?   鈹?accept()         鈹?         鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹?reject()         鈹?         鈹?鈹?                         鈹?importCorpus()   鈹?         鈹?鈹?                         鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?         鈹?鈹?                                                        鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?         鈹?鈹? 鈹? useThemeStore   鈹?   鈹? useUIStore      鈹?         鈹?鈹? 鈹?                 鈹?   鈹?                 鈹?         鈹?鈹? 鈹?theme: ThemeKind  鈹?   鈹?leftPanelOpen    鈹?         鈹?鈹? 鈹?language: Lang    鈹?   鈹?leftPanelWidth   鈹?         鈹?鈹? 鈹?toggleTheme()    鈹?   鈹?problemsPanelOpen鈹?         鈹?鈹? 鈹?setLanguage()    鈹?   鈹?recentFiles[]    鈹?         鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?         鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

#### 2.2.2 Store 鎺ュ彛瀹氫箟

```typescript
// ============================================================
// useStoryStore 鈥?鏁呬簨鏁版嵁锛圓ST 鐨勭湡瀹炴潵婧愶級
// ============================================================
interface StoryState {
  plotFlowData: PlotFlowData | null;
  rawFrontmatter: string;           // 鍘熷 YAML 鏂囨湰锛堢敤浜庝繚鐣欐敞閲?鏍煎紡锛?  variables: Map<string, VariableDefinition>;

  // Actions
  setPlotFlowData: (data: PlotFlowData) => void;
  updateVariable: (name: string, def: Partial<VariableDefinition>) => void;
  getNodeById: (fullId: string) => StoryNode | undefined;
  getChapterById: (id: string) => Chapter | undefined;
  getAllNodeIds: () => string[];
  clear: () => void;
}

// ============================================================
// useEditorStore 鈥?缂栬緫鍣ㄧ姸鎬?// ============================================================
interface EditorState {
  rawMarkdown: string;              // Monaco 涓殑鍘熷鏂囨湰
  cursorPosition: { line: number; column: number };
  activeNodeId: string | null;      // 鍏夋爣鎵€鍦ㄨ妭鐐圭殑 fullId
  isDirty: boolean;                 // 鑷笂娆′繚瀛樺悗鏄惁鏈変慨鏀?  selections: Selection[];          // Monaco 閫夊尯
  monacoModel: MonacoEditorModel | null;
  monacoEditor: MonacoEditorInstance | null;

  // Actions
  setRawMarkdown: (text: string) => void;
  setCursorPosition: (pos: { line: number; column: number }) => void;
  setActiveNodeId: (id: string | null) => void;
  markClean: () => void;
  markDirty: () => void;
  insertTextAtCursor: (text: string) => void;
  scrollToLine: (line: number) => void;
  setMonacoModel: (model: MonacoEditorModel) => void;
  setMonacoEditor: (editor: MonacoEditorInstance) => void;
}

// ============================================================
// useGraphStore 鈥?鍒嗘敮鍥剧姸鎬?// ============================================================
interface GraphState {
  nodes: StoryFlowNode[];           // React Flow 鑺傜偣
  edges: StoryFlowEdge[];           // React Flow 杩炵嚎
  selectedNodeId: string | null;
  viewport: { x: number; y: number; zoom: number };
  layoutVersion: number;            // 甯冨眬鐗堟湰鍙凤紙姣忔閲嶆柊甯冨眬閫掑锛?
  // Actions
  syncFromAST: (data: PlotFlowData) => void;
  setSelectedNode: (id: string | null) => void;
  updateEdgeTarget: (edgeId: string, newTargetNodeId: string) => void;
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
  resetLayout: () => void;
  getNodePosition: (id: string) => { x: number; y: number } | undefined;
}

// ============================================================
// useValidatorStore 鈥?璇婃柇鐘舵€?// ============================================================
interface ValidatorState {
  diagnostics: Diagnostic[];        // 瀹屾暣璇婃柇鍒楄〃
  diagnosticsByNode: Map<string, Diagnostic[]>;  // 鎸夎妭鐐瑰垎缁?  diagnosticsByLine: Map<number, Diagnostic[]>;  // 鎸夎鍙峰垎缁?  errorCount: number;
  warningCount: number;
  infoCount: number;

  // Actions
  validate: (data: PlotFlowData, rawText: string) => void;
  clearForNode: (nodeId: string) => void;
  clearAll: () => void;
  getDiagnosticsForLine: (line: number) => Diagnostic[];
  getDiagnosticsForNode: (nodeId: string) => Diagnostic[];
}

// ============================================================
// useCompletionStore 鈥?琛ュ叏鐘舵€?// ============================================================
interface CompletionState {
  currentSuggestion: CompletionSuggestion | null;
  candidates: CompletionSuggestion[];  // Ctrl+Space 涓嬫媺鍊欓€?  isComputing: boolean;
  triggerContext: CompletionContext | null;
  engineStatus: 'idle' | 'training' | 'ready' | 'error';

  // Actions
  requestCompletion: (context: CompletionContext) => Promise<void>;
  accept: () => void;               // Tab 鈥?鎺ュ彈褰撳墠骞界伒寤鸿
  reject: () => void;               // Esc 鈥?蹇界暐
  cycleNext: () => void;            // 鍒囨崲鍊欓€?  openCandidates: () => void;       // Ctrl+Space
  importCorpus: (files: File[]) => Promise<void>;
  getCorpusList: () => CorpusEntry[];
  removeCorpus: (id: string) => void;
  setEngineStatus: (status: CompletionState['engineStatus']) => void;
}

// ============================================================
// useThemeStore 鈥?涓婚鍜岃瑷€
// ============================================================
interface ThemeState {
  theme: 'dark' | 'light';
  activeThemePackId: string;          // default: plotflow-narrative-workbench
  language: 'zh-CN' | 'en';

  // Actions
  toggleTheme: () => void;
  setTheme: (t: 'dark' | 'light') => void;
  setActiveThemePackId: (id: string) => void;
  setLanguage: (l: 'zh-CN' | 'en') => void;
}

// ============================================================
// useUIStore 鈥?UI 甯冨眬鍜屾潅椤?// ============================================================
interface UIState {
  leftPanelOpen: boolean;
  leftPanelWidth: number;
  problemsPanelOpen: boolean;
  problemsPanelHeight: number;
  recentFiles: RecentFileEntry[];
  activeFilePath: string | null;

  // Actions
  toggleLeftPanel: () => void;
  setLeftPanelWidth: (w: number) => void;
  toggleProblemsPanel: () => void;
  setProblemsPanelHeight: (h: number) => void;
  addRecentFile: (entry: RecentFileEntry) => void;
  setActiveFilePath: (path: string | null) => void;
}
```

#### 2.2.3 鍗曞悜鏁版嵁娴?
```
                           鏂囨湰鏄敮涓€鐪熷疄鏉ユ簮
                           ====================
鐢ㄦ埛杈撳叆 (Monaco Editor)
       鈹?       鈻?(500ms debounce)
rawMarkdown (useEditorStore)
       鈹?       鈻?(Parser 瑙ｆ瀽)
PlotFlowData AST (useStoryStore)
       鈹?       鈹溾攢鈹€鈫?useValidatorStore.validate()  鈫?diagnostics[]  鈫?Monaco setModelMarkers()
       鈹?                                                    鈫?ProblemsPanel 鍒楄〃
       鈹?                                                    鈫?OutlineView 鐘舵€佹爣璁?       鈹?       鈹溾攢鈹€鈫?useGraphStore.syncFromAST()   鈫?nodes[]/edges[] 鈫?ReactFlowGraph 娓叉煋
       鈹?                                                    鈫?鑺傜偣鐘舵€佺潃鑹?       鈹?       鈹溾攢鈹€鈫?OutlineView (鐩存帴浠?useStoryStore 璇诲彇绔犺妭/鑺傜偣)
       鈹?       鈹溾攢鈹€鈫?useCompletionStore.requestCompletion()
       鈹?    鈫?寮傛 Worker 璁＄畻
       鈹?    鈫?currentSuggestion 鈫?CompletionGhostText
       鈹?       鈹斺攢鈹€鈫?Exporter (鎸夐渶, 浠?PlotFlowData 瀵煎嚭)

鍙嶅悜娴侊紙鍥惧舰缂栬緫 鈫?鏂囨湰鍚屾锛?
ReactFlowGraph.onEdgeUpdate()
       鈹?       鈻?useGraphStore.updateEdgeTarget()
       鈹?       鈻?PlotFlowData AST 淇敼 (useStoryStore)
       鈹?       鈻?鐢熸垚鏂扮殑 Markdown 鏂囨湰 (AST 鈫?Markdown serialization)
       鈹?       鈻?Monaco Editor 鏂囨湰鏇挎崲 (淇濈暀鍏夋爣浣嶇疆鍜屾挙閿€鏍?
```

### 2.3 Monaco Editor 闆嗘垚

#### 2.3.1 Monarch Tokenizer 鈥?PlotFlow 璇硶楂樹寒

```typescript
// monarch-tokens.ts
// 閫氳繃 monaco.languages.setMonarchTokensProvider('plotflow', tokenizer) 娉ㄥ唽

const plotFlowTokenizer: monaco.languages.IMonarchLanguage = {
  tokenizer: {
    root: [
      // YAML Frontmatter
      [/^---\s*$/, 'frontmatter-delimiter'],
      [/^---\s*$/, { token: 'frontmatter-delimiter', next: '@frontmatter' }],
      [/^[a-zA-Z_涓€-榭縘[a-zA-Z0-9_涓€-榭縘*\s*:/, 'frontmatter-key'],

      // 绔犺妭鏍囬 H1: # 绗竴绔狅細xxx
      [/^#\s+(?!鑺傜偣锛?[^\n]+/, 'chapter-heading'],

      // 鑺傜偣鏍囬 H2: ## 鑺傜偣锛歺xx
      [/^##\s+鑺傜偣锛?, 'node-heading-keyword'],
      [/(?<=^##\s+鑺傜偣锛?[^\n]+/, 'node-heading-title'],

      // H3-H6 瀛愭爣棰橈紙閫夐」鍖烘爣璁扮瓑锛?      [/^(#{3,6})\s+(?!鑺傜偣锛?[^\n]+/, 'section-heading'],

      // 閫夐」琛?[閫夐」] 鏂囨湰 -> 鑺傜偣锛氱洰鏍?      [/^\[閫夐」\]/, 'option-keyword'],
      [/(?<=^\[閫夐」\]\s+)[^\n]+?(?=\s*->)/, 'option-description'],
      [/->/, 'option-arrow'],
      [/鑺傜偣锛?, 'option-target-keyword'],
      [/(?<=鑺傜偣锛?[^\n]+/, 'option-target-name'],

      // 鏉′欢瀛愯: 鏉′欢: (expr)
      [/^\s+鏉′欢:/, 'condition-keyword'],
      [/(?<=鏉′欢:\s*).+/, 'condition-expression'],

      // 鏁堟灉瀛愯: 鏁堟灉: (ops)
      [/^\s+鏁堟灉:/, 'effect-keyword'],
      [/(?<=鏁堟灉:\s*).+/, 'effect-expression'],

      // 鍙橀噺寮曠敤: $鍙橀噺鍚?      [/\$[a-zA-Z_涓€-榭縘[a-zA-Z0-9_.涓€-榭縘*/, 'variable-reference'],

      // 鍒嗛殧绾?      [/^---\s*$/, 'separator'],

      // 鍔犵矖/鏂滀綋
      [/\*\*[^*]+\*\*/, 'bold'],
      [/\*[^*]+\*/, 'italic'],
    ],

    frontmatter: [
      [/^[a-zA-Z_涓€-榭縘[a-zA-Z0-9_涓€-榭縘*\s*:/, 'frontmatter-key'],
      [/^---\s*$/, { token: 'frontmatter-delimiter', next: '@pop' }],
      [/./, 'frontmatter-value'],
    ],
  },

  // Token 鍒?CSS 绫荤殑鏄犲皠
  // 鏆楄壊涓婚鑹插€肩敱 CSS 鍙橀噺鎺у埗, 姝ゅ浠呭畾涔夎涔?token
};
```

#### 2.3.2 涓婚瀹氫箟锛圡onaco `defineTheme`锛?
```typescript
// monaco-themes.ts

// 鏆楄壊涓婚: plotflow-dark
monaco.editor.defineTheme('plotflow-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'frontmatter-delimiter', foreground: '808080', fontStyle: 'bold' },
    { token: 'frontmatter-key', foreground: '9CDCFE' },
    { token: 'frontmatter-value', foreground: 'CE9178' },
    { token: 'chapter-heading', foreground: 'D7BA7D', fontStyle: 'bold' },
    { token: 'node-heading-keyword', foreground: '569CD6', fontStyle: 'bold' },
    { token: 'node-heading-title', foreground: '4FC1FF' },
    { token: 'option-keyword', foreground: '6A9955' },
    { token: 'option-description', foreground: 'D4D4D4' },
    { token: 'option-arrow', foreground: '4EC9B0' },
    { token: 'option-target-keyword', foreground: '4EC9B0' },
    { token: 'option-target-name', foreground: '9CDCFE' },
    { token: 'condition-keyword', foreground: 'CE9178' },
    { token: 'condition-expression', foreground: 'CE9178' },
    { token: 'effect-keyword', foreground: 'DCDCAA' },
    { token: 'effect-expression', foreground: 'DCDCAA' },
    { token: 'variable-reference', foreground: 'C586C0' },
    { token: 'separator', foreground: '808080' },
  ],
  colors: {
    'editor.background': '#1E1E1E',
    'editor.foreground': '#D4D4D4',
    'editor.lineHighlightBackground': '#2A2D2E',
    'editor.selectionBackground': '#264F78',
    'editorCursor.foreground': '#AEAFAD',
  },
});

// 浜壊涓婚: plotflow-light (鐣? 鍚岀悊瀵硅皟鑹插€?
monaco.editor.defineTheme('plotflow-light', {
  base: 'vs',
  inherit: true,
  rules: [
    // ... 浜壊鑹插€?  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#333333',
    // ...
  },
});
```

#### 2.3.3 InlineCompletionItemProvider 鈥?骞界伒琛ュ叏

```typescript
// inline-completion-provider.ts
// 閫氳繃 monaco.languages.registerInlineCompletionsProvider('plotflow', provider) 娉ㄥ唽

const inlineCompletionProvider: monaco.languages.InlineCompletionsProvider = {
  provideInlineCompletions: async (
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.InlineCompletions> => {
    // 1. 浠?useCompletionStore 鑾峰彇褰撳墠寤鸿
    const { currentSuggestion, triggerContext } = useCompletionStore.getState();

    if (!currentSuggestion || !triggerContext) {
      return { items: [] };
    }

    // 2. 楠岃瘉瑙﹀彂鏉′欢鏄惁浠嶇劧鏈夋晥
    if (!isTriggerStillValid(model, position, triggerContext)) {
      return { items: [] };
    }

    // 3. 鏋勫缓 InlineCompletionItem
    const item: monaco.languages.InlineCompletion = {
      insertText: currentSuggestion.text,
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
      // 鍙€? 鎻愪緵鍛戒护鍦ㄦ寜涓嬫椂鎵ц锛堝璁板綍鎺ュ彈浜嬩欢鐢ㄤ簬瀛︿範锛?      command: {
        id: 'plotflow.completion.accepted',
        title: 'Completion Accepted',
        arguments: [currentSuggestion.id, triggerContext],
      },
    };

    return { items: [item] };
  },

  // 鐢ㄤ簬閲婃斁璧勬簮
  freeInlineCompletions: (_completions: monaco.languages.InlineCompletions) => {},
};
```

#### 2.3.4 Diagnostic Markers (setModelMarkers)

```typescript
// diagnostic-markers.ts

function syncDiagnosticsToMonaco(
  model: monaco.editor.ITextModel,
  diagnostics: Diagnostic[],
  rawText: string
): void {
  const markers: monaco.editor.IMarkerData[] = diagnostics.map((d) => {
    const severity = diagnosticSeverityToMonaco(d.level);
    // 閫氳繃琛屽彿/鍒楀彿璁＄畻 startColumn/endColumn
    const { startLineNumber, startColumn, endLineNumber, endColumn } =
      calculateRange(rawText, d.location);

    return {
      severity,
      message: formatDiagnosticMessage(d),
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
      source: 'PlotFlow',
      code: d.code, // e.g. 'E001', 'W002', 'I001'
    };
  });

  monaco.editor.setModelMarkers(model, 'plotflow-diagnostics', markers);
}

function diagnosticSeverityToMonaco(level: DiagnosticLevel): monaco.MarkerSeverity {
  switch (level) {
    case 'error':   return monaco.MarkerSeverity.Error;   // 绾㈣壊娉㈡氮绾?    case 'warning': return monaco.MarkerSeverity.Warning; // 榛勮壊娉㈡氮绾?    case 'info':    return monaco.MarkerSeverity.Info;    // 钃濊壊涓嬪垝绾?  }
}
```

#### 2.3.5 闃叉姈绛栫暐

```typescript
// editor-debounce.ts

// Monaco Change Event 鈫?500ms debounce 鈫?瑙﹀彂鍏ㄧ绾?const DEBOUNCE_MS = 500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function onEditorContentChanged(newContent: string): void {
  if (debounceTimer) clearTimeout(debounceTimer);

  // 绔嬪嵆鏇存柊缂栬緫鍣?store锛堝搷搴斿紡 UI 鍗虫椂鍙嶉锛?  useEditorStore.getState().setRawMarkdown(newContent);
  useEditorStore.getState().markDirty();

  debounceTimer = setTimeout(() => {
    // 1. 瑙ｆ瀽
    const parseResult = parsePlotFlow(newContent);
    useStoryStore.getState().setPlotFlowData(parseResult.data);

    // 2. 楠岃瘉
    useValidatorStore.getState().validate(parseResult.data, newContent);

    // 3. 鍚屾鍒嗘敮鍥?    useGraphStore.getState().syncFromAST(parseResult.data);

    // 4. 瑙﹀彂琛ュ叏
    const ctx = buildCompletionContext(parseResult.data, newContent);
    useCompletionStore.getState().requestCompletion(ctx);

    // 5. 鍚屾 Monaco Markers
    const model = useEditorStore.getState().monacoModel;
    if (model) {
      syncDiagnosticsToMonaco(model, useValidatorStore.getState().diagnostics, newContent);
    }
  }, DEBOUNCE_MS);
}

// 琛ュ叏瑙﹀彂鏈夌嫭绔嬬殑鏇寸煭闃叉姈 (200ms, 浠呭綋杈撳叆鍋滈】)
const COMPLETION_DEBOUNCE_MS = 200;
```

### 2.4 React Flow 闆嗘垚

#### 2.4.1 鑷畾涔夎妭鐐圭粍浠?(StoryNode)

```typescript
// StoryNode.tsx
const StoryNode: React.FC<NodeProps<StoryNodeData>> = ({ data, selected }) => {
  const statusClass = STATUS_CLASS_MAP[data.status];
  // STATUS_CLASS_MAP:
  //   'normal'    鈫?'node-status-normal'    (缁胯壊杈规)
  //   'orphan'    鈫?'node-status-orphan'    (榛勮壊杈规)
  //   'deadend'   鈫?'node-status-deadend'   (鐏拌壊杈规)
  //   'error'     鈫?'node-status-error'     (绾㈣壊杈规)
  //   'selected'  鈫?'node-status-selected'  (钃濊壊鍏夋檿)

  return (
    <div
      className={cn('story-node', statusClass, { selected })}
      onClick={() => data.onClick(data.id)}
      onDoubleClick={() => data.onDoubleClick(data.id)}
    >
      <div className="story-node-header">
        <span className="node-status-dot" />
        <span className="node-title">{data.title}</span>
        <span className="node-badge">{data.optionCount}</span>
      </div>
      <div className="story-node-preview">{data.preview}</div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};
```

#### 2.4.2 鑷畾涔夎竟缁勪欢

```typescript
// ConditionEdge.tsx 鈥?鏉′欢杩炵嚎 (铏氱嚎姗欒壊)
const ConditionEdge: React.FC<EdgeProps> = (props) => {
  const edgePath = getBezierPath(props);
  return (
    <>
      <BaseEdge path={edgePath} style={{ stroke: 'var(--color-edge-conditional)', strokeDasharray: '5,5' }} />
      <EdgeLabelRenderer>
        <div className="edge-condition-label">{props.data?.conditionText}</div>
      </EdgeLabelRenderer>
    </>
  );
};

// UnconditionalEdge.tsx 鈥?鏃犳潯浠惰繛绾?(瀹炵嚎闈掕壊)
const UnconditionalEdge: React.FC<EdgeProps> = (props) => {
  const edgePath = getBezierPath(props);
  return <BaseEdge path={edgePath} style={{ stroke: 'var(--color-edge-unconditional)' }} />;
};
```

#### 2.4.3 甯冨眬閫夋嫨涓?Dagre 閰嶇疆

`.mdstory` 鍙湪 Frontmatter 涓繚瀛?Graph Lab 鎵嬪姩甯冨眬锛?
```yaml
layout:
  graph:
    version: 1
    nodes:
      - id: "绗竴绔?鏉戝彛"
        x: 120
        y: 80
```

甯冨眬瑙勫垯锛?
1. 瑙ｆ瀽鍣ㄨ鍙?`layout.graph.nodes` 骞跺缓绔?`fullId -> {x, y}` 绱㈠紩銆?2. AST 鈫?React Flow 閫傞厤鏃讹紝鑻ヨ妭鐐瑰瓨鍦ㄦ寔涔呭寲鍧愭爣鍒欎紭鍏堜娇鐢ㄨ鍧愭爣銆?3. 缂哄け鍧愭爣鐨勮妭鐐圭户缁蛋 Dagre 鑷姩甯冨眬銆?4. 鐢ㄦ埛鎷栨嫿鑺傜偣鏃跺彧瀹炴椂鏇存柊 React Flow 鍙楁帶鑺傜偣锛涙澗鎵嬪悗鐢?`graphEditService.updateNodePosition()` 鍐欏洖 layout 鍧楀苟瑙﹀彂瑙ｆ瀽銆?5. 鑺傜偣閲嶅懡鍚嶃€佺Щ鍔ㄧ珷鑺傛垨鍒犻櫎鏃讹紝`graphEditService` 蹇呴』杩佺Щ鎴栨竻鐞嗗搴?layout 椤癸紝閬垮厤鎮┖鍧愭爣銆?
```typescript
// dagre-layout.ts
import dagre from '@dagrejs/dagre';

function layoutNodes(chapters: Chapter[]): { nodes: StoryFlowNode[]; edges: StoryFlowEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',          // Top-to-Bottom
    align: 'UL',
    nodesep: 150,           // 鍚屽眰鑺傜偣姘村钩闂磋窛 (px)
    ranksep: 120,           // 鐖跺瓙灞傚瀭鐩撮棿璺?(px)
    edgesep: 30,
    marginx: 50,
    marginy: 50,
  });

  // 鑺傜偣灏哄
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 80;

  const allNodes = chapters.flatMap(ch => ch.nodes);

  // 娣诲姞鑺傜偣
  for (const node of allNodes) {
    g.setNode(node.fullId, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // 娣诲姞杈癸紙浠庨€夐」鐨?targetFullId锛?  for (const node of allNodes) {
    for (const option of node.options) {
      g.setEdge(node.fullId, option.targetFullId);
    }
  }

  dagre.layout(g);

  // 杞崲涓?React Flow 鏍煎紡锛涙墜鍔?layout 浼樺厛锛岀己澶辨椂浣跨敤 Dagre 鍧愭爣
  const nodes: StoryFlowNode[] = allNodes.map((node) => {
    const pos = g.node(node.fullId);
    const manualPosition = layoutIndex.get(node.fullId);
    return {
      id: node.fullId,
      type: 'storyNode',
      position: manualPosition ?? {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      data: { /* ... 鑺傜偣鏁版嵁 */ },
    };
  });

  const edges: StoryFlowEdge[] = allNodes.flatMap((node) =>
    node.options.map((opt, idx) => ({
      id: `${node.fullId}->${opt.targetFullId}#${idx}`,
      source: node.fullId,
      target: opt.targetFullId,
      type: opt.conditions ? 'conditionEdge' : 'unconditionalEdge',
      data: {
        isConditional: !!opt.conditions,
        conditionText: opt.conditions?.expression,
      },
    }))
  );

  // 瀛ょ珛鑺傜偣澶勭悊锛氭斁鍦ㄧ敾甯冨彸渚х嫭绔嬪尯鍩?  const connectedIds = new Set(edges.flatMap(e => [e.source, e.target]));
  let orphanX = Math.max(...nodes.map(n => n.position.x + NODE_WIDTH)) + 200;
  for (const node of nodes) {
    if (!connectedIds.has(node.id) && node.data.optionCount > 0) {
      // 鏍硅妭鐐瑰彲鍦ㄤ换鎰忎綅缃?    } else if (!connectedIds.has(node.id)) {
      node.position = { x: orphanX, y: node.position.y };
      orphanX += NODE_WIDTH + 150;
    }
  }

  return { nodes, edges };
}
```

#### 2.4.4 浜嬩欢澶勭悊锛氬浘褰㈢紪杈?鈫?鏂囨湰鍚屾

```typescript
// Graph Lab 鍛戒护灞傦細鎵€鏈?GUI 缂栬緫鍏堢敓鎴?.mdstory patch锛屽啀璧拌В鏋愮绾?function connectOption(option: StoryOption, targetNodeId: string | null): void {
  graphEditService.connectOption(option, targetNodeId);
}

function createNodeAndConnect(
  sourceNode: StoryNode,
  option: StoryOption,
  title: string,
  dropPosition: { x: number; y: number },
): void {
  graphEditService.createNodeAndConnect(sourceNode, option, title, dropPosition);
}

function updateNodePosition(node: StoryNode, position: { x: number; y: number }): void {
  // 鎷栧姩涓彧鏇存柊 React Flow 鍙楁帶鑺傜偣锛屾澗鎵嬪悗鍐欏洖 layout.graph.nodes銆?  graphEditService.updateNodePosition(node, position);
}
```

### 2.5 鏉′欢缂栬緫鍣?
#### 2.5.1 缁勪欢缁撴瀯

```
ConditionEditorPanel
鈹溾攢鈹€ ConditionGroupList (鍙祵濂? 鏈€澶?灞?
鈹?  鈹斺攢鈹€ ConditionGroup
鈹?      鈹溾攢鈹€ GroupHeader (AND / OR 鍒囨崲)
鈹?      鈹溾攢鈹€ ConditionRow[] (澶氭潯鏉′欢)
鈹?      鈹?  鈹溾攢鈹€ VariableDropdown (鏁版嵁婧? Frontmatter 鍙橀噺 鎴?寮曟搸鍙橀噺)
鈹?      鈹?  鈹溾攢鈹€ OperatorDropdown (==, !=, >, <, >=, <=)
鈹?      鈹?  鈹斺攢鈹€ ValueInput (绫诲瀷鎰熺煡: int/float 鏁板瓧妗? bool 澶嶉€夋, enum 涓嬫媺, string 鏂囨湰妗?
鈹?      鈹溾攢鈹€ AddConditionButton (鍦ㄥ綋鍓嶇粍娣诲姞鏉′欢)
鈹?      鈹斺攢鈹€ RemoveGroupButton (绉婚櫎褰撳墠鏉′欢缁?
鈹溾攢鈹€ AddGroupButton (娣诲姞 AND 缁?
鈹溾攢鈹€ AddOrGroupButton (娣诲姞 OR 缁?
鈹溾攢鈹€ ExpressionPreview (瀹炴椂棰勮鐢熸垚鐨勬枃鏈〃杈惧紡)
鈹斺攢鈹€ ActionButtons
    鈹溾攢鈹€ ApplyButton
    鈹斺攢鈹€ CancelButton
```

#### 2.5.2 鍙屽悜鍚屾鏈哄埗

```
闈㈡澘淇敼 鈫?鐢熸垚鏉′欢琛ㄨ揪寮忓瓧绗︿覆 鈫?鏇存柊 AST
                                    鈹?                                    鈻?                              serializeOptionText()
                                    鈹?                                    鈻?                              鏇挎崲 Monaco 涓搴旈€夐」鐨勬潯浠跺瓙琛屾枃鏈?
鏂囨湰鎵嬪姩缂栬緫 鈫?缂栬緫鍣?change event 鈫?Parser 瑙ｆ瀽
                                        鈹?                                        鈻?                                  鏇存柊 AST
                                        鈹?                                        鈻?                                  闈㈡澘閲嶆柊璇诲彇 AST 涓殑 conditions 瀛楁
                                        鈹?                                        鈻?                                  闈㈡澘鍒锋柊鏄剧ず
```

#### 2.5.3 鍙橀噺涓嬫媺鏁版嵁婧?
```typescript
// 鐙珛妯″紡: 浠?Frontmatter YAML 瑙ｆ瀽鐨勫彉閲忓垪琛?// 鎻掍欢妯″紡: 浠庡紩鎿庡悓姝ョ殑鍙橀噺鍒楄〃 (鍙, 涓嶅彲鍒涘缓鏂板彉閲?

function getAvailableVariables(): VariableOption[] {
  const mode = detectRunMode(); // 'standalone' | 'plugin'

  if (mode === 'standalone') {
    const vars = useStoryStore.getState().variables;
    return Array.from(vars.entries()).map(([name, def]) => ({
      name,
      type: def.type,
      enumValues: def.type === 'enum' ? def.values : undefined,
      scope: def.scope,
    }));
  } else {
    // 鎻掍欢妯″紡: 浠庡紩鎿庤幏鍙?    return window.plotflow.getEngineVariables();
  }
}
```

---

---

## 3. 鏍稿績灞?(Core / Pure TypeScript) `[V0.1 鍏ㄩ儴, 搂3.3.6 鎻掍欢鎺ュ彛 V0.1-V0.3]`

鏍稿績灞傛槸闆?UI 渚濊禆鐨勭函 TypeScript 浠ｇ爜锛屽彲鐙珛娴嬭瘯銆佺嫭绔嬪彂甯冧负 npm 鍖呫€?
### 3.1 瑙ｆ瀽鍣?(Parser)

#### 3.1.1 Pipeline 鏋舵瀯

```
.mdstory 鏂囨湰
      鈹?      鈻?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?        unified() 澶勭悊绠￠亾               鈹?鈹?                                        鈹?鈹? .use(remarkParse)         鈫?鍩虹 Markdown 鈫?mdast     鈹?鈹? .use(frontmatterPlugin)   鈫?鎻愬彇 YAML Frontmatter     鈹?鈹? .use(nodeParserPlugin)    鈫?璇嗗埆 ## 鑺傜偣锛?            鈹?鈹? .use(optionParserPlugin)  鈫?璇嗗埆 [閫夐」] + 鏉′欢/鏁堟灉    鈹?鈹? .use(variableRefPlugin)   鈫?璇嗗埆 $鍙橀噺 寮曠敤            鈹?鈹? .use(diagnosticTagPlugin) 鈫?鏍囪璇硶閿欒浣嶇疆            鈹?鈹?                                        鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                     鈹?                     鈻?              PlotFlowData AST
```

#### 3.1.2 Plugin 1: frontmatter-parser

```typescript
// frontmatter-plugin.ts
// 鑱岃矗: 鎻愬彇 YAML Frontmatter, 瑙ｆ瀽鍙橀噺瀹氫箟, 杩斿洖 VariableDefinition[]

function frontmatterPlugin(): Transformer {
  return (tree: Root, file: VFile) => {
    // 1. 鏌ユ壘绗竴涓?YAML delim node (---)
    const firstChild = tree.children[0];
    if (firstChild?.type !== 'yaml') {
      file.message('Missing Frontmatter', { line: 1, column: 1 }, 'plotflow:no-frontmatter');
      return;
    }

    // 2. 浣跨敤 js-yaml 瑙ｆ瀽
    const yamlContent = firstChild.value;
    let frontmatter: FrontmatterData;
    try {
      frontmatter = yaml.load(yamlContent) as FrontmatterData;
    } catch (e) {
      file.message(`YAML parse error: ${(e as Error).message}`, firstChild.position!, 'plotflow:yaml-error');
      return;
    }

    // 3. 鎻愬彇鍙橀噺瀹氫箟
    const variables: VariableDefinition[] = [];
    if (frontmatter.vars) {
      for (const [name, def] of Object.entries(frontmatter.vars)) {
        variables.push(parseVariableDefinition(name, def, file));
      }
    }

    // 4. 瀛樺叆 VFile data
    (file.data as any).frontmatter = {
      plotflow: frontmatter.plotflow ?? '0.1',
      title: frontmatter.title ?? 'Untitled',
      author: frontmatter.author,
      engine: frontmatter.engine ?? 'none',
      variables,
      raw: frontmatter,
    };

    // 5. 浠?AST 涓Щ闄?frontmatter, 鍚庣画澶勭悊涓嶅啀閬囧埌瀹?    tree.children.shift();
  };
}

function parseVariableDefinition(
  name: string,
  def: any,
  file: VFile
): VariableDefinition {
  // 瑙ｆ瀽绫诲瀷: int, float, bool, string, enum[...], object{...}
  if (typeof def === 'string') {
    return { name, type: def as any, default: getDefaultValue(def), scope: 'global' };
  }
  if (typeof def === 'object' && def !== null) {
    // enum
    if (Array.isArray(def)) {
      return { name, type: 'enum', values: def, default: def[0] ?? '', scope: 'global' };
    }
    // object
    if (!Array.isArray(def)) {
      const fields: Record<string, VariableDefinition> = {};
      for (const [fieldName, fieldDef] of Object.entries(def)) {
        fields[fieldName] = parseVariableDefinition(fieldName, fieldDef, file);
      }
      return { name, type: 'object', fields, scope: 'global' };
    }
  }
  file.message(`Invalid variable definition for "${name}"`, {}, 'plotflow:invalid-var-def');
  return { name, type: 'string', default: '', scope: 'global' };
}
```

#### 3.1.3 Plugin 2: node-parser

```typescript
// node-parser-plugin.ts
// 鑱岃矗: 璇嗗埆 ## 鑺傜偣锛歺xx 鏍囬, 鎻愬彇鑺傜偣瀹氫箟

function nodeParserPlugin(): Transformer {
  return (tree: Root, file: VFile) => {
    const chapters: Chapter[] = [];
    let currentChapter: Chapter | null = null;
    let currentNodes: StoryNode[] = [];
    let currentNodeBuilder: NodeBuilder | null = null;
    let hasAnyH1 = false;

    for (const child of tree.children) {
      // H1: 绔犺妭鏍囬
      if (child.type === 'heading' && child.depth === 1) {
        hasAnyH1 = true;
        // 淇濆瓨鍓嶄竴涓珷鑺?        if (currentChapter) {
          currentChapter.nodes = currentNodes;
          chapters.push(currentChapter);
        }
        const title = getHeadingText(child);
        currentChapter = { id: title, title, nodes: [] };
        currentNodes = [];
        currentNodeBuilder = null;
        continue;
      }

      // H2: ## 鑺傜偣锛氳妭鐐瑰悕
      if (child.type === 'heading' && child.depth === 2 && child.children[0]?.value?.startsWith('鑺傜偣锛?)) {
        // 淇濆瓨鍓嶄竴涓妭鐐?        if (currentNodeBuilder) {
          const node = currentNodeBuilder.build();
          if (node) currentNodes.push(node);
        }
        const nodeTitle = child.children[0].value.replace(/^鑺傜偣锛?, '').trim();
        // 鏃?H1 鏃?chapterId 涓虹┖锛宖ullId 涓嶅寘鍚珷鑺傚墠缂€锛堣妭鐐规墎骞冲寲锛?        currentNodeBuilder = new NodeBuilder(nodeTitle, currentChapter?.id ?? '');
        continue;
      }

      // H3+: 瀛愭爣棰橈紙濡?### 閫夐」鍖猴級鈥?瑙ｆ瀽鍣ㄥ拷鐣?      if (child.type === 'heading' && child.depth >= 3) {
        continue; // 蹇界暐瀛愭爣棰? 缁х画绱Н鍒板綋鍓嶈妭鐐?      }

      // 娈佃惤: 绱Н鍒板綋鍓嶈妭鐐?body
      if (child.type === 'paragraph' && currentNodeBuilder) {
        const text = getPlainText(child);
        currentNodeBuilder.addBodyLine(text);
        continue;
      }

      // 鍒嗛殧绾? --- 锛堢粨鏉熷綋鍓嶈妭鐐瑰潡, 浣嗕笉鍒涘缓鏂拌妭鐐癸級
      if (child.type === 'thematicBreak' && currentNodeBuilder) {
        const node = currentNodeBuilder.build();
        if (node) currentNodes.push(node);
        currentNodeBuilder = null;
        continue;
      }
    }

    // 淇濆瓨鏈€鍚庝竴涓妭鐐瑰拰绔犺妭
    if (currentNodeBuilder) {
      const node = currentNodeBuilder.build();
      if (node) currentNodes.push(node);
    }
    // 鍚珷鑺? 淇濆瓨鏈€鍚庝竴涓珷鑺?    if (currentChapter) {
      currentChapter.nodes = currentNodes;
      chapters.push(currentChapter);
    }
    // 鏃?H1 鍦烘櫙: 鑺傜偣鎵佸钩鍖?鈥?鎵€鏈夎妭鐐瑰綊鍏ュ尶鍚嶉粯璁ょ珷鑺? fullId 涓嶅惈绔犺妭鍓嶇紑
    if (!hasAnyH1 && currentNodes.length > 0) {
      chapters.push({ id: '', title: '', nodes: currentNodes });
    }

    (file.data as any).chapters = chapters;
  };
}
```

#### 3.1.4 Plugin 3: option-parser

```typescript
// option-parser-plugin.ts
// 鑱岃矗: 璇嗗埆 [閫夐」] 琛?+ 鏉′欢瀛愯 + 鏁堟灉瀛愯

class NodeBuilder {
  private options: Option[] = [];
  private currentOptionBuilder: OptionBuilder | null = null;

  addBodyLine(text: string): void {
    // 妫€娴嬫槸鍚︿负 [閫夐」] 琛?    const optionMatch = text.match(/^\[閫夐」\]\s+(.+?)\s*->\s*鑺傜偣锛?.+)$/);
    if (optionMatch) {
      // 淇濆瓨鍓嶄竴涓?option builder
      if (this.currentOptionBuilder) {
        this.options.push(this.currentOptionBuilder.build());
      }
      const [, description, target] = optionMatch;
      this.currentOptionBuilder = new OptionBuilder(description.trim(), target.trim());
      return;
    }
    // 妫€娴嬩笉瀹屾暣鐨?[閫夐」] 琛岋紙缂哄皯 -> 鑺傜偣锛氱洰鏍囨爣璇嗭級
    // 淇濈暀涓烘鏂囦笉涓㈠純锛泇alidator 鐢熸垚璀﹀憡璇婃柇
    const incompleteOption = text.match(/^\[閫夐」\]\s+(.+)$/);
    if (incompleteOption) {
      this.bodyLines.push(text);
      return;
    }

    // 妫€娴嬫潯浠跺瓙琛? 鏉′欢: (...)
    const conditionMatch = text.match(/^\s+鏉′欢:\s*(.+)$/);
    if (conditionMatch && this.currentOptionBuilder) {
      const condExpr = conditionMatch[1].trim();
      const parsedCondition = parseConditionExpression(condExpr);
      this.currentOptionBuilder.setConditions(parsedCondition);
      return;
    }

    // 妫€娴嬫晥鏋滃瓙琛? 鏁堟灉: (...)
    const effectMatch = text.match(/^\s+鏁堟灉:\s*\(\s*(.+?)\s*\)\s*$/);
    if (effectMatch && this.currentOptionBuilder) {
      const effectsStr = effectMatch[1];
      const effects = parseSideEffects(effectsStr);
      this.currentOptionBuilder.setSideEffects(effects);
      return;
    }

    // 鍏朵粬琛? 杩藉姞鍒?body 鎴栧綋鍓?option builder 鐨勫厓鏁版嵁
    if (this.currentOptionBuilder) {
      // 鍙兘鏄笉鏍囧噯鐨勫瓙琛? 褰掑叆鍓嶄竴涓?option
      this.currentOptionBuilder.addExtraLine(text);
    } else {
      this.bodyLines.push(text);
    }
  }

  build(): StoryNode | null {
    if (this.currentOptionBuilder) {
      this.options.push(this.currentOptionBuilder.build());
    }
    return {
      id: this.title,
      chapterId: this.chapterId,
      fullId: this.chapterId ? `${this.chapterId}/${this.title}` : this.title,
      title: this.title,
      body: this.bodyLines.filter(Boolean),
      options: this.options,
      position: { x: 0, y: 0 },
      isRoot: false,
      isOrphan: false,
      isDeadEnd: false,
    };
  }
}
```

#### 3.1.5 鏉′欢琛ㄨ揪寮忚В鏋愬櫒

```typescript
// condition-parser.ts
// 瑙ｆ瀽鏉′欢琛ㄨ揪寮? ($a>=5) AND ($b==true) OR NOT ($c!='foo')

type ConditionAST =
  | ComparisonNode
  | LogicalAndNode
  | LogicalOrNode
  | LogicalNotNode;

interface ComparisonNode {
  type: 'comparison';
  variable: string;       // e.g. '濂芥劅搴? 鎴?'瑙掕壊鐘舵€?榄斿姏'
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  value: string | number | boolean;
}

interface LogicalAndNode {
  type: 'logical_and';
  left: ConditionAST;
  right: ConditionAST;
}

interface LogicalOrNode {
  type: 'logical_or';
  left: ConditionAST;
  right: ConditionAST;
}

interface LogicalNotNode {
  type: 'logical_not';
  operand: ConditionAST;
}

function parseConditionExpression(expr: string): Condition | null {
  if (!expr || expr.trim() === '') return null;

  try {
    const tokens = tokenizeCondition(expr);
    const ast = parseConditionTokens(tokens);
    return {
      expression: expr,
      ast,
    };
  } catch (e) {
    // 瑙ｆ瀽澶辫触 鈥?淇濈暀鍘熷琛ㄨ揪寮忓瓧绗︿覆锛孉ST 涓?null
    return {
      expression: expr,
      ast: null,
      parseError: (e as Error).message,
    };
  }
}

// 鍒嗚瘝鍣? 璇嗗埆 $鍙橀噺銆佽繍绠楃銆佹嫭鍙枫€佸瓧闈㈤噺
function tokenizeCondition(expr: string): Token[] {
  const tokens: Token[] = [];
  const regex = /(\$[a-zA-Z_涓€-榭縘[a-zA-Z0-9_.涓€-榭縘*)|(==|!=|>=|<=|>|<)|(AND|OR|NOT|and|or|not)|([()])|('([^']*)')|("([^"]*)")|(\d+\.?\d*)|(true|false)/gi;
  let match;
  while ((match = regex.exec(expr)) !== null) {
    tokens.push(classifyToken(match));
  }
  // 瑙勮寖鍖栧叧閿瓧澶у皬鍐? and鈫扐ND, or鈫扥R, not鈫扤OT
  return tokens.map(t => {
    if (t.type === 'keyword') {
      t.value = (t.value as string).toUpperCase();
    }
    return t;
  });
  return tokens;
}
```

#### 3.1.6 閿欒鎭㈠绛栫暐

```typescript
// error-recovery.ts
// 鏈€浣冲姫鍔涜В鏋? 灏藉彲鑳藉鍦版彁鍙栨湁鏁堟暟鎹? 鏍囪鏃犳硶瑙ｆ瀽鐨勯儴鍒?
interface ParseResult {
  data: PlotFlowData;
  errors: ParseError[];       // 闃绘柇瑙ｆ瀽鐨勯敊璇?  warnings: ParseWarning[];   // 鍙仮澶嶇殑闂
}

function parsePlotFlow(rawText: string): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  // 1. 灏濊瘯 Frontmatter 瑙ｆ瀽
  //    澶辫触 鈫?璁板綍閿欒, 浣跨敤榛樿 frontmatter, 缁х画瑙ｆ瀽姝ｆ枃

  // 2. 灏濊瘯鑺傜偣瑙ｆ瀽
  //    鏌愯鏃犳硶璇嗗埆 鈫?璁板綍 ParseError, 璺宠繃璇ヨ, 缁х画涓嬩竴琛?
  // 3. 灏濊瘯閫夐」瑙ｆ瀽
  //    閫夐」缂哄皯 -> 鈫?璁板綍 E005, 浠嶅皢鏂囨湰褰掑叆 body, 缁х画

  // 4. 灏濊瘯鏉′欢/鏁堟灉瑙ｆ瀽
  //    琛ㄨ揪寮忔牸寮忛敊璇?鈫?淇濈暀鍘熷瀛楃涓? ast = null, 缁х画

  return { data: buildData(frontmatter, chapters), errors, warnings };
}
```

### 3.2 璇硶妫€鏌ュ櫒 (Validator)

#### 3.2.1 涓夌骇璇婃柇浣撶郴

```typescript
// types.ts (diagnostic)
type DiagnosticLevel = 'error' | 'warning' | 'info';

interface Diagnostic {
  code: string;                    // e.g. 'E001', 'W002', 'I001'
  level: DiagnosticLevel;
  message: string;                 // 浜虹被鍙鎻忚堪
  location: DiagnosticLocation;    // 琛屽彿鑼冨洿
  nodeId?: string;                 // 鍏宠仈鐨勮妭鐐?fullId (鍙€?
  suggestion?: string;             // 淇寤鸿 (鍙€?
  quickFix?: QuickFix;             // 涓€閿慨澶嶅姩浣?(鍙€?
}

interface DiagnosticLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface QuickFix {
  label: string;
  action: 'create-node' | 'add-variable' | 'add-default-option' | 'jump-to';
  payload: Record<string, unknown>;
}
```

#### 3.2.2 閿欒妫€娴嬪櫒 (8 绉?

| 缂栧彿 | 妫€娴嬪櫒 | 妫€娴嬮€昏緫 | 鏍囪浣嶇疆 |
|------|--------|---------|---------|
| E001 | TargetNotFoundDetector | 閬嶅巻鎵€鏈夐€夐」鐨?targetFullId锛屾鏌ユ槸鍚﹀瓨鍦ㄤ簬鎵€鏈夎妭鐐圭殑 fullId 闆嗗悎涓?| `-> 鑺傜偣锛歑XX` 琛?|
| E002 | UndeclaredVariableDetector | 閬嶅巻鎵€鏈夋潯浠?鏁堟灉涓紩鐢ㄧ殑 `$鍙橀噺`锛屾鏌ユ槸鍚﹀湪 Frontmatter variables Map 涓?| `$鍙橀噺` 浣嶇疆 |
| E003 | IllegalEnumDetector | 妫€鏌ユ晥鏋滀腑鐨勮祴鍊兼搷浣滐紝楠岃瘉鍊兼槸鍚﹀湪澹版槑鐨?enum values 涓?| 鏁堟灉鎷彿鍐?|
| E004 | TypeMismatchDetector | 妫€鏌ユ晥鏋滄搷浣滅殑鍊肩被鍨嬩笌鍙橀噺澹版槑绫诲瀷鏄惁涓€鑷达紙濡?bool 涓嶈兘 +1锛?| 鏁堟灉鎷彿鍐?|
| E005 | ParseFailureDetector | 鏀堕泦 Parser 杩斿洖鐨?ParseError 鍒楄〃锛岃浆鎹负 Diagnostic | 瑙ｆ瀽澶辫触琛?|
| E006 | NestingExceededDetector | 閬嶅巻 Frontmatter variables锛屾鏌?object 宓屽娣卞害鏄惁瓒呰繃 3 | Frontmatter |
| E007 | DuplicateNodeDetector | 妫€鏌ユ墍鏈夎妭鐐圭殑 fullId 鏄惁鏈夐噸澶?| `## 鑺傜偣锛歚 琛?|
| E008 | DuplicateVariableDetector | 妫€鏌?Frontmatter 鍙橀噺鍚嶆槸鍚︽湁閲嶅 | Frontmatter |

```typescript
// validators/error-detectors.ts

function detectTargetNotFound(data: PlotFlowData): Diagnostic[] {
  const allNodeIds = new Set(
    data.chapters.flatMap(ch => ch.nodes.map(n => n.fullId))
  );
  const diagnostics: Diagnostic[] = [];

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      for (const option of node.options) {
        if (!allNodeIds.has(option.targetFullId)) {
          diagnostics.push({
            code: 'E001',
            level: 'error',
            message: `鐩爣鑺傜偣銆?{option.targetFullId}銆嶄笉瀛樺湪`,
            location: option.location,  // 閫夐」琛岀殑浣嶇疆
            nodeId: node.fullId,
            suggestion: `鍙敤鑺傜偣: ${[...allNodeIds].slice(0, 5).join(', ')}...`,
            quickFix: {
              label: `鍒涘缓鑺傜偣銆?{option.targetFullId}銆峘,
              action: 'create-node',
              payload: { nodeName: option.targetNodeId, chapterId: option.targetChapterId },
            },
          });
        }
      }
    }
  }
  return diagnostics;
}
```

#### 3.2.3 璀﹀憡妫€娴嬪櫒 (7 绉?

| 缂栧彿 | 妫€娴嬪櫒 | 妫€娴嬮€昏緫 |
|------|--------|---------|
| W001 | OrphanNodeDetector | 鑺傜偣涓嶆槸鏍硅妭鐐癸紝涓旀病鏈変换浣曢€夐」鐨?targetFullId 鎸囧悜瀹?|
| W002 | DeadEndDetector | 节点没有任何出口；出口包括普通 `[选项]` 边和节点级 `下一步` 边，结局节点除外 |
| W003 | UnusedVariableDetector | Frontmatter 澹版槑鐨勫彉閲忓湪鍏ㄦ枃锛堟潯浠?鏁堟灉锛変腑鏈寮曠敤 |
| W004 | DuplicateOptionTextDetector | 鍚屼竴鑺傜偣涓嬩袱涓€夐」鐨?text 瀹屽叏鐩稿悓锛坱rim + toLowerCase 姣旇緝锛?|
| W005 | EmptyDescriptionDetector | 鑺傜偣 body 涓虹┖鏁扮粍鎴栨墍鏈?body 琛?trim 鍚庝负绌?|
| W006 | FormatIrregularDetector | 绔犺妭鏍囬涓嶄互 `# ` 寮€澶达紝鎴栬妭鐐规爣棰樹笉浠?`## 鑺傜偣锛歚 寮€澶?|
| W007 | ClosedCycleDetector | 使用 SCC 检测由普通选项边和 `下一步` 边组成的无外部出口闭环；未解析目标跳过，继续由 E001 负责 |

#### 3.2.4 寤鸿妫€娴嬪櫒 (3 绉?

| 缂栧彿 | 妫€娴嬪櫒 | 妫€娴嬮€昏緫 |
|------|--------|---------|
| I001 | PossibleSoftlockDetector | 鑺傜偣鐨勬墍鏈夐€夐」閮芥湁鏉′欢锛屾病鏈夋棤鏉′欢(default)閫夐」 |
| I002 | ShortDescriptionDetector | 鑺傜偣鎵€鏈?body 琛?join 鍚庨暱搴?< 10 瀛楃 |
| I003 | NoChapterDetector | 鏍硅妭鐐逛箣鍓嶆病鏈?H1 绔犺妭鏍囬 |

#### 3.2.5 楠岃瘉鍣ㄤ富鍏ュ彛

```typescript
// validator.ts

const ERROR_DETECTORS: ErrorDetectorFn[] = [
  detectTargetNotFound,
  detectUndeclaredVariable,
  detectIllegalEnum,
  detectTypeMismatch,
  detectParseFailure,
  detectNestingExceeded,
  detectDuplicateNode,
  detectDuplicateVariable,
];

const WARNING_DETECTORS: WarningDetectorFn[] = [
  detectOrphanNode,
  detectDeadEnd,
  detectUnusedVariable,
  detectDuplicateOptionText,
  detectEmptyDescription,
  detectFormatIrregular,
  detectClosedCycle,
];

const INFO_DETECTORS: InfoDetectorFn[] = [
  detectPossibleSoftlock,
  detectShortDescription,
  detectNoChapter,
];

function validate(data: PlotFlowData, rawText: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 骞惰杩愯鎵€鏈夋娴嬪櫒锛堢函璁＄畻锛屾棤鍓綔鐢級
  for (const detector of ERROR_DETECTORS) {
    diagnostics.push(...detector(data, rawText));
  }
  for (const detector of WARNING_DETECTORS) {
    diagnostics.push(...detector(data, rawText));
  }
  for (const detector of INFO_DETECTORS) {
    diagnostics.push(...detector(data, rawText));
  }

  // 鍘婚噸: 鍚屼竴浣嶇疆鐨勫悓绫诲瀷璇婃柇鍙繚鐣欎竴涓?  return deduplicateDiagnostics(diagnostics);
}
```

### 3.3 瀵煎嚭鍣?(Exporter)

#### 3.3.1 Pipeline 鏋舵瀯

```
PlotFlowData AST
       鈹?       鈻?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?        Exporter Pipeline        鈹?鈹?                                 鈹?鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹? 鈹? Format-specific Renderer  鈹? 鈹?鈹? 鈹?                           鈹? 鈹?鈹? 鈹? JSONRenderer  鈫?.json     鈹? 鈹?鈹? 鈹? HTMLRenderer  鈫?.html     鈹? 鈹?鈹? 鈹? TXTRenderer   鈫?.txt      鈹? 鈹?鈹? 鈹? GodotRenderer 鈫?.json     鈹? 鈹?鈹? 鈹? UnityRenderer 鈫?.json     鈹? 鈹?鈹? 鈹? (plugin formatters)       鈹? 鈹?鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

#### 3.3.2 瀵煎嚭鍣ㄦ帴鍙?
```typescript
// exporter/types.ts

interface IExporter {
  readonly format: ExportFormat;
  readonly extension: string;
  readonly mimeType: string;

  export(data: PlotFlowData, config: ExportConfig): ExportResult;
  exportToString(data: PlotFlowData, config: ExportConfig): string;
}

type ExportFormat = 'json' | 'html' | 'txt' | 'godot' | 'unity' | 'unreal';

interface ExportConfig {
  format: ExportFormat;
  pretty?: boolean;               // JSON: 2-space indent
  includeDiagnostics?: boolean;   // 鏄惁瀵煎嚭 isOrphan/isDeadEnd 绛?  targetEngine?: 'godot' | 'unity' | 'unreal';
  htmlTheme?: 'dark' | 'light';
  embedAssets?: boolean;          // HTML: 鍐呭祵 CSS/JS
}

interface ExportResult {
  success: boolean;
  content: string;                // 瀵煎嚭鍐呭
  fileName: string;               // 寤鸿鏂囦欢鍚?  warnings?: string[];            // 闈為樆鏂鍛?  errors?: string[];              // 闃绘柇閿欒
}
```

#### 3.3.3 JSON 瀵煎嚭鍣?
```typescript
// exporter/json-exporter.ts

class JSONExporter implements IExporter {
  readonly format = 'json';
  readonly extension = '.json';
  readonly mimeType = 'application/json';

  export(data: PlotFlowData, config: ExportConfig): ExportResult {
    const exportData: StoryJSON = {
      $schema: `https://plotflow.dev/schema/${config.formatVersion ?? '0.1'}/story.json`,
      meta: {
        plotflow: data.meta.plotflow,
        title: data.meta.title,
        author: data.meta.author,
        engine: data.meta.engine ?? 'none',
        exportedAt: new Date().toISOString(),
      },
      variables: this.serializeVariables(data.variables),
      chapters: data.chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        nodes: ch.nodes.map(n => ({
          id: n.id,
          chapterId: n.chapterId,
          fullId: n.fullId,
          title: n.title,
          body: n.body,
          options: n.options.map(opt => ({
            index: opt.index,
            text: opt.text,
            targetNodeId: opt.targetNodeId,
            targetFullId: opt.targetFullId,
            conditions: this.serializeCondition(opt.conditions),
            sideEffects: opt.sideEffects?.map(this.serializeSideEffect) ?? [],
          })),
          position: n.position,
          isRoot: n.isRoot,
          isOrphan: n.isOrphan,
          isDeadEnd: n.isDeadEnd,
        })),
      })),
    };

    const indent = config.pretty !== false ? 2 : 0;
    const content = JSON.stringify(exportData, null, indent);

    return {
      success: true,
      content,
      fileName: `${data.meta.title.replace(/\s+/g, '_')}.json`,
    };
  }

  private serializeCondition(cond: Condition | null): object | null {
    if (!cond) return null;
    return {
      expression: cond.expression,
      ast: cond.ast,  // 鐩存帴搴忓垪鍖?AST锛圝SON 鍏煎锛?    };
  }

  private serializeSideEffect(effect: SideEffect): object {
    return {
      variable: effect.variable,
      operation: effect.operation,
      value: effect.value,
    };
  }
}
```

#### 3.3.4 HTML 瀵煎嚭鍣?
```typescript
// exporter/html-exporter.ts

class HTMLExporter implements IExporter {
  readonly format = 'html';
  readonly extension = '.html';
  readonly mimeType = 'text/html';

  export(data: PlotFlowData, config: ExportConfig): ExportResult {
    const theme = config.htmlTheme ?? 'dark';
    const html = this.buildHTML(data, theme);

    return {
      success: true,
      content: html,
      fileName: `${data.meta.title.replace(/\s+/g, '_')}.html`,
    };
  }

  private buildHTML(data: PlotFlowData, theme: 'dark' | 'light'): string {
    // 鐢熸垚鍗曟枃浠?HTML锛屽寘鍚?
    // 1. 鍐呭祵 CSS 鍙橀噺锛堟殫鑹?浜壊涓婚锛?    // 2. JavaScript 鍐呭祵浜や簰寮曟搸锛堣交閲忕骇锛?
    //    - 鑺傜偣娓叉煋鍑芥暟
    //    - 閫夐」鎸夐挳鐢熸垚锛堝惈鏉′欢妫€鏌ュ拰 馃敀 鏍囪锛?    //    - 闈㈠寘灞戝鑸?    //    - 鍙橀噺闈㈡澘
    //    - localStorage 淇濆瓨杩涘害
    // 3. 灏?PlotFlowData 搴忓垪鍖栦负 JS 鍐呭祵瀵硅薄:
    //    <script>const STORY_DATA = {...};</script>

    const storyJSON = JSON.stringify(this.serializeForHTML(data));
    const css = this.getThemeCSS(theme);
    const js = this.getInteractionJS();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.meta.title)} 鈥?PlotFlow</title>
  <style>${css}</style>
</head>
<body>
  <div id="plotflow-app">
    <nav id="breadcrumb"></nav>
    <main id="story-content"></main>
    <div id="options-panel"></div>
    <footer id="variable-panel"></footer>
  </div>
  <script>const STORY_DATA = ${storyJSON};</script>
  <script>${js}</script>
</body>
</html>`;
  }
}
```

#### 3.3.5 TXT 瀵煎嚭鍣?
```typescript
// exporter/txt-exporter.ts

class TXTExporter implements IExporter {
  readonly format = 'txt';
  readonly extension = '.txt';
  readonly mimeType = 'text/plain; charset=utf-8';

  export(data: PlotFlowData, _config: ExportConfig): ExportResult {
    const lines: string[] = [];
    lines.push(`# ${data.meta.title}`);
    lines.push('');

    for (const chapter of data.chapters) {
      lines.push(`## ${chapter.title}`);
      lines.push('');

      for (const node of chapter.nodes) {
        lines.push(`### ${node.title}`);
        for (const line of node.body) {
          lines.push(line);
        }
        lines.push('');

        for (const option of node.options) {
          const cond = option.conditions ? ` [鏉′欢: ${option.conditions.expression}]` : '';
          lines.push(`  鈫?${option.text} (璺宠浆鍒? ${option.targetNodeId})${cond}`);
        }
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    return {
      success: true,
      content: lines.join('\n'),
      fileName: `${data.meta.title.replace(/\s+/g, '_')}.txt`,
    };
  }
}
```

#### 3.3.6 鎻掍欢鎺ュ彛瀹氫箟

```typescript
// plugin-api.ts

// 寮曟搸鎻掍欢閫氳繃瀹炵幇姝ゆ帴鍙ｆ帴鍏?PlotFlow 瀵煎嚭绠＄嚎
// V0.1: Godot 瀹屾暣瀹炵幇, Unity 鎺ュ彛+绀轰緥, Unreal 浠呮帴鍙ｅ畾涔?
interface IEnginePlugin {
  /** 鎻掍欢鍚嶇О */
  readonly name: string;

  /** 鐩爣寮曟搸 */
  readonly engine: 'godot' | 'unity' | 'unreal';

  /** 浠?PlotFlowData 鐢熸垚寮曟搸涓撶敤鏍煎紡 */
  exportForEngine(data: PlotFlowData, config: EngineExportConfig): string;

  /** 浠庡紩鎿庨」鐩鍙栧彉閲忓垪琛紙鎻掍欢妯″紡鐢級 */
  readEngineVariables?(projectPath: string): EngineVariable[];

  /** 妫€鏌ュ紩鎿庨」鐩槸鍚﹀凡瀹夎姝ゆ彃浠?*/
  isInstalledInProject?(projectPath: string): boolean;
}

interface EngineExportConfig {
  projectPath: string;
  outputDir: string;
  includeRuntimeLibs?: boolean;
  prettyPrint?: boolean;
}

interface EngineVariable {
  name: string;
  type: string;
  defaultValue: unknown;
  description?: string;
}
```

### 3.4 琛ュ叏寮曟搸 (Completion Engine)

#### 3.4.1 N-gram 寮曟搸鏋舵瀯锛堢Щ妞嶈嚜 MarkLuck锛?
```
                    鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                    鈹?    CompletionEngine           鈹?                    鈹?                               鈹?  瑙﹀彂涓婁笅鏂?鈹€鈹€鈹€鈹€鈹€鈹€鈻衡攤  鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?  (CompletionCtx)  鈹? 鈹?ContextWindowExtractor   鈹? 鈹?                    鈹? 鈹?(鎻愬彇鍓嶅悗N瀛?            鈹? 鈹?                    鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?                    鈹?             鈹?                鈹?                    鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈻尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?                    鈹? 鈹?InvertedIndex            鈹? 鈹?                    鈹? 鈹?(鍊掓帓绱㈠紩: prefix鈫抧grams)鈹? 鈹?                    鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?                    鈹?             鈹?                鈹?                    鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈻尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?                    鈹? 鈹?Ranker                   鈹? 鈹?                    鈹? 鈹?(棰戠巼 脳 鏃舵晥 脳 璇)     鈹? 鈹?                    鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?                    鈹?             鈹?                鈹?                    鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈻尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?                    鈹? 鈹?CorpusManager            鈹? 鈹?                    鈹? 鈹?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? 鈹?                    鈹? 鈹?鈹傞缃鏂欌攤 鈹傛湰鍦板涔?  鈹?鈹? 鈹?                    鈹? 鈹?鈹?(5MB) 鈹?鈹?(澧為噺)   鈹?鈹? 鈹?                    鈹? 鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? 鈹?                    鈹? 鈹?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? 鈹?                    鈹? 鈹?鈹?鐢ㄦ埛瀵煎叆璇枡           鈹?鈹? 鈹?                    鈹? 鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? 鈹?                    鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹?                    鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                                    鈹?                                    鈻?                          CompletionSuggestion[]
```

#### 3.4.2 鍥涚淮瑙﹀彂瀹氫箟

```typescript
// completion/triggers.ts

type CompletionDimension = 'node-title' | 'option-text' | 'body-text' | 'variable-name';

interface CompletionContext {
  dimension: CompletionDimension;
  /** 鐢ㄦ埛宸茶緭鍏ョ殑鏂囨湰鍓嶇紑 */
  prefix: string;
  /** 鍏夋爣鍓?N 瀛椾笂涓嬫枃锛堟牴鎹淮搴︿笉鍚岋級 */
  contextBefore: string;
  /** 鍏夋爣鍚?N 瀛椾笂涓嬫枃 */
  contextAfter?: string;
  /** 褰撳墠鑺傜偣鏍囬锛堢敤浜庢鏂囪ˉ鍏級 */
  currentNodeTitle?: string;
  /** 褰撳墠鑺傜偣鐨勫凡鏈夐€夐」鍒楄〃锛堢敤浜庡彞寮忚ˉ鍏級 */
  existingOptions?: string[];
  /** Frontmatter 鍙橀噺鍒楄〃锛堢敤浜庡彉閲忚ˉ鍏級 */
  availableVariables?: string[];
  /** 鍏夋爣浣嶇疆 */
  cursorPosition: Position;
}

// 瑙﹀彂妫€娴嬪嚱鏁?function detectTrigger(
  text: string,
  cursorPosition: Position
): CompletionContext | null {
  const line = getLineAt(text, cursorPosition.line);
  const textBeforeCursor = line.substring(0, cursorPosition.column);

  // 1. 鑺傜偣鏍囬瑙﹀彂: 璇ヨ浠?'# 鑺傜偣锛? 鎴?'## 鑺傜偣锛? 寮€澶?  if (/^(#{1,2})\s+鑺傜偣锛?.test(line)) {
    const afterKeyword = line.replace(/^(#{1,2})\s+鑺傜偣锛歕s*/, '');
    return {
      dimension: 'node-title',
      prefix: afterKeyword,
      contextBefore: textBeforeCursor,
      cursorPosition,
    };
  }

  // 2. 閫夐」鍙ュ紡瑙﹀彂: 璇ヨ浠?'[閫夐」]' 寮€澶?  if (/^\[閫夐」\]\s+/.test(line)) {
    const afterOption = line.replace(/^\[閫夐」\]\s+/, '');
    return {
      dimension: 'option-text',
      prefix: afterOption,
      contextBefore: textBeforeCursor,
      existingOptions: detectExistingOptions(text),
      cursorPosition,
    };
  }

  // 3. 鍙橀噺鍚嶈Е鍙? 鍏夋爣鍓嶆渶杩戠殑闈炵┖鐧藉瓧绗﹀簭鍒椾互 '$' 缁撳熬
  const dollarMatch = textBeforeCursor.match(/\$(\w*)$/);
  if (dollarMatch) {
    return {
      dimension: 'variable-name',
      prefix: dollarMatch[1],
      contextBefore: textBeforeCursor,
      availableVariables: getAvailableVariableNames(),
      cursorPosition,
    };
  }

  // 4. 姝ｆ枃鎻忚堪瑙﹀彂: 鍦ㄦ鏂囨钀戒腑锛堥潪鐗规畩琛岋級
  if (!isSpecialLine(line)) {
    return {
      dimension: 'body-text',
      prefix: textBeforeCursor,
      contextBefore: textBeforeCursor.slice(-50),  // 鍓?0瀛?      cursorPosition,
    };
  }

  return null;
}
```

#### 3.4.3 N-gram 寮曟搸鏍稿績

```typescript
// completion/ngram-engine.ts
// 绉绘鑷?MarkLuck: packages/app/src/utils/ngram-engine.ts

interface NGramEntry {
  context: string[];        // 鍓?N-1 涓?token
  completion: string;       // 琛ュ叏鏂囨湰
  frequency: number;        // 鍑虹幇娆℃暟
  lastSeenAt: number;       // 鏈€鍚庡嚭鐜版椂闂存埑
  source: 'baseline' | 'user' | 'imported';  // 璇枡鏉ユ簮
}

class NGramEngine {
  private ngrams: Map<number, Map<string, NGramEntry[]>> = new Map();
  //                                     ^ prefix 鈫?entries

  /** 鏈€澶?N-gram 闀垮害 */
  private readonly maxN = 5;

  /** 浠庤鏂欐枃鏈腑璁粌 */
  train(text: string, source: NGramEntry['source']): void {
    const tokens = this.tokenize(text);
    for (let n = 1; n <= this.maxN; n++) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const context = tokens.slice(i, i + n - 1);
        const completion = tokens[i + n - 1];
        const prefix = context.join('');

        if (!this.ngrams.has(n)) {
          this.ngrams.set(n, new Map());
        }
        const levelMap = this.ngrams.get(n)!;
        if (!levelMap.has(prefix)) {
          levelMap.set(prefix, []);
        }

        const entries = levelMap.get(prefix)!;
        const existing = entries.find(e => e.completion === completion);
        if (existing) {
          existing.frequency++;
          existing.lastSeenAt = Date.now();
        } else {
          entries.push({
            context,
            completion,
            frequency: 1,
            lastSeenAt: Date.now(),
            source,
          });
        }
      }
    }
  }

  /** 澧為噺瀛︿範锛堢敤鎴蜂繚瀛樻椂瑙﹀彂锛?*/
  incrementalLearn(text: string): void {
    this.train(text, 'user');
  }

  /** 棰勬祴琛ュ叏 */
  predict(context: CompletionContext, topK: number = 5): CompletionSuggestion[] {
    const tokens = this.tokenize(context.contextBefore);
    const results: CompletionSuggestion[] = [];

    // 浠庢渶闀?N-gram 寮€濮嬪皾璇曞尮閰?    for (let n = Math.min(this.maxN, tokens.length); n >= 1; n--) {
      const prefix = tokens.slice(-(n - 1)).join('');
      const entries = this.ngrams.get(n)?.get(prefix);
      if (entries && entries.length > 0) {
        const scored = entries
          .filter(e => e.completion.startsWith(context.prefix))
          .map(e => ({
            text: e.completion,
            score: this.calculateScore(e, context),
            source: e.source,
          }));
        scored.sort((a, b) => b.score - a.score);
        results.push(...scored.slice(0, topK));
        break;  // 鏈€闀垮尮閰嶄紭鍏?      }
    }

    return results;
  }

  /** 璇勫垎鍑芥暟: 棰戠巼 脳 鏃舵晥鎬ц“鍑?脳 璇枡鏉ユ簮鏉冮噸 */
  private calculateScore(entry: NGramEntry, context: CompletionContext): number {
    const frequencyWeight = Math.log2(entry.frequency + 1);

    // 鏃舵晥鎬ц“鍑? 90澶?half-life
    const daysSinceSeen = (Date.now() - entry.lastSeenAt) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.pow(0.5, daysSinceSeen / 90);

    // 鏉ユ簮鏉冮噸: user > imported > baseline
    const sourceWeight = { baseline: 0.5, imported: 1.0, user: 1.5 }[entry.source];

    return frequencyWeight * recencyWeight * sourceWeight;
  }

  /** 鍒嗚瘝锛堜腑鏂囨寜瀛楃 + 鏍囩偣鍒囧垎锛岃嫳鏂囨寜璇嶏級 */
  private tokenize(text: string): string[] {
    // 绠€鍗曠瓥鐣? 鎸?Unicode 绫诲埆鍒囧垎
    const tokens: string[] = [];
    let current = '';
    for (const char of text) {
      if (/[涓€-榭縘/.test(char)) {
        if (current) { tokens.push(current); current = ''; }
        tokens.push(char);
      } else if (/[a-zA-Z0-9]/.test(char)) {
        current += char;
      } else {
        if (current) { tokens.push(current); current = ''; }
        tokens.push(char);
      }
    }
    if (current) tokens.push(current);
    return tokens.filter(t => t.trim() !== '');
  }

  /** 鏉冮噸琛板噺: 绉婚櫎 90 澶╂湭瑙佷笖婧愪负 baseline 鐨勬潯鐩?*/
  prune(olderThanDays: number = 180): void {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    for (const [n, levelMap] of this.ngrams) {
      for (const [prefix, entries] of levelMap) {
        const filtered = entries.filter(e =>
          e.lastSeenAt > cutoff || e.source !== 'baseline'
        );
        if (filtered.length === 0) {
          levelMap.delete(prefix);
        } else {
          levelMap.set(prefix, filtered);
        }
      }
    }
  }

  /** 搴忓垪鍖栦负绱у噾鏍煎紡锛堢敤浜庢寔涔呭寲锛?*/
  serialize(): ArrayBuffer { /* 鑷畾涔夌揣鍑戜簩杩涘埗鏍煎紡 */ }

  /** 浠庣揣鍑戞牸寮忓弽搴忓垪鍖?*/
  static deserialize(buffer: ArrayBuffer): NGramEngine { /* ... */ }
}
```

#### 3.4.4 鏈湴瀛︿範鍣?
```typescript
// completion/local-learner.ts

class LocalLearner {
  private engine: NGramEngine;
  private db: Database;  // better-sqlite3锛堜粎瀛樺偍鍏冩暟鎹拰璇枡绱㈠紩锛?
  /** 淇濆瓨鏂囦欢鏃跺閲忓涔?*/
  async learnFromSave(mdstoryContent: string): Promise<void> {
    // 鎻愬彇鐢ㄦ埛鍐欎綔鍐呭锛堝幓闄?Frontmatter 鍜屾爣璁拌娉曪級
    const cleanText = extractPlainText(mdstoryContent);

    // 澧為噺璁粌
    this.engine.incrementalLearn(cleanText);

    // 寮傛鎸佷箙鍖栧紩鎿庣姸鎬?    await this.persistEngine();
  }

  /** 鑾峰彇琛ュ叏寤鸿 */
  getSuggestions(context: CompletionContext): CompletionSuggestion[] {
    // 鍙橀噺琛ュ叏鏈夌壒娈婅矾寰?    if (context.dimension === 'variable-name') {
      return this.getVariableCompletions(context);
    }
    return this.engine.predict(context);
  }

  /** 鍙橀噺鍚嶈ˉ鍏?鈥?鐩存帴鍖归厤 Frontmatter */
  private getVariableCompletions(context: CompletionContext): CompletionSuggestion[] {
    const vars = context.availableVariables ?? [];
    return vars
      .filter(v => v.startsWith(context.prefix))
      .map(v => ({
        text: v,
        score: 100,  // 绮剧‘鍖归厤浼樺厛
        source: 'variable' as const,
      }));
  }

  private async persistEngine(): Promise<void> {
    // 瀛樺偍鍒? %APPDATA%/PlotFlow/learner/ngram.dat
  }
}
```

#### 3.4.5 璇枡绠＄悊鍣?
```typescript
// completion/corpus-manager.ts

interface CorpusEntry {
  id: string;
  fileName: string;
  size: number;             // bytes
  importedAt: Date;
  enabled: boolean;
  category: 'rpg' | 'visual-novel' | 'puzzle' | 'general';
}

class CorpusManager {
  private db: Database;     // better-sqlite3: 璇枡鍏冩暟鎹?  private engine: NGramEngine;
  private maxTotalSize = 50 * 1024 * 1024;  // 50MB
  private maxFileSize = 10 * 1024 * 1024;   // 10MB per file

  /** 瀵煎叆璇枡鏂囦欢 */
  async importFile(filePath: string): Promise<CorpusEntry> {
    const stat = await fs.stat(filePath);
    if (stat.size > this.maxFileSize) {
      throw new Error(`鏂囦欢瓒呰繃闄愬埗 (${this.maxFileSize / 1024 / 1024}MB)`);
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const cleaned = this.preprocess(content, path.extname(filePath));

    // 璁粌寮曟搸
    this.engine.train(cleaned, 'imported');

    return {
      id: nanoid(),
      fileName: path.basename(filePath),
      size: stat.size,
      importedAt: new Date(),
      enabled: true,
      category: this.detectCategory(cleaned),
    };
  }

  /** 棰勫鐞? 鍘婚噸銆佸垎娈点€佹竻娲?*/
  private preprocess(text: string, ext: string): string {
    if (ext === '.mdstory') {
      // 鎻愬彇姝ｆ枃锛堝幓闄?Frontmatter 鍜屾爣璁帮級
      text = extractPlainText(text);
    } else if (ext === '.csv') {
      // 璇诲彇绗簩鍒楋紙鏂囨湰鍒楋級
      text = parseCSVText(text);
    }
    // 鍘婚噸锛堢紪杈戣窛绂?< 3 瑙嗕负閲嶅锛?    text = deduplicateSentences(text);
    // 娓呮礂: 鍘婚櫎 URL, 浠ｇ爜鍧?    text = cleanText(text);
    return text;
  }

  /** 妫€娴嬭鏂欑被鍒?*/
  private detectCategory(text: string): CorpusEntry['category'] {
    // 鍏抽敭璇嶅惎鍙戝紡鍒嗙被
    // 鍚?鏀诲嚮/闃插尽/琛€閲?缁忛獙 鈫?rpg
    // 鍚?鍛婄櫧/绾︿細/濂芥劅 鈫?visual-novel
    // 鍚?绾跨储/瀵嗙爜/閽ュ寵/瀵嗗 鈫?puzzle
    // 鍏朵粬 鈫?general
    return 'general';
  }
}
```

#### 3.4.6 Monaco InlineCompletionItemProvider 閫傞厤

```typescript
// completion/monaco-adapter.ts

class MonacoCompletionAdapter implements monaco.languages.InlineCompletionsProvider {
  private learner: LocalLearner;

  constructor(learner: LocalLearner) {
    this.learner = learner;
  }

  async provideInlineCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    _context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.InlineCompletions> {
    // 1. 鑾峰彇缂栬緫鍣ㄦ枃鏈?    const text = model.getValue();

    // 2. 妫€娴嬭Е鍙戞潯浠?    const triggerCtx = detectTrigger(text, {
      line: position.lineNumber,
      column: position.column,
    });

    if (!triggerCtx) {
      return { items: [] };
    }

    // 3. 娉ㄥ叆鍙橀噺鍒楄〃锛堝鏋滈渶瑕侊級
    if (triggerCtx.dimension === 'variable-name') {
      const vars = useStoryStore.getState().variables;
      triggerCtx.availableVariables = Array.from(vars.keys());
    }

    // 4. 鑾峰彇寤鸿锛?00ms timeout锛?    const suggestions = this.learner.getSuggestions(triggerCtx);

    if (token.isCancellationRequested) {
      return { items: [] };
    }

    // 5. 杞崲涓?Monaco InlineCompletionItem
    return {
      items: suggestions.map(s => ({
        insertText: s.text,
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
      })),
    };
  }
}
```

---

## 4. Electron 涓昏繘绋?`[V0.1]`

### 4.1 File I/O 鏈嶅姟

```typescript
// src-electron/services/file-service.ts

import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

// IPC 閫氶亾瀹氫箟
const IPC_CHANNELS = {
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:saveAs',
  FILE_WATCH: 'file:watch',
  FILE_READ: 'file:read',
  FILE_EXISTS: 'file:exists',
  FILE_RECENT: 'file:getRecent',
  FILE_NEW_TEMPLATE: 'file:newFromTemplate',
} as const;

interface FileService {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  openDialog(): Promise<string | null>;
  saveDialog(defaultName: string): Promise<string | null>;
  watchFile(filePath: string, callback: (event: string) => void): void;
}

function registerFileService(mainWindow: BrowserWindow): void {
  // 鎵撳紑鏂囦欢瀵硅瘽妗?  ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '鎵撳紑 PlotFlow 鏂囦欢',
      filters: [
        { name: 'PlotFlow 鏁呬簨鏂囦欢', extensions: ['mdstory'] },
        { name: '鎵€鏈夋枃浠?, extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    return { filePath, content };
  });

  // 淇濆瓨鏂囦欢
  ipcMain.handle(IPC_CHANNELS.FILE_SAVE, async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  });

  // 鍙﹀瓨涓?  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_AS, async (_event, content: string) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '淇濆瓨 PlotFlow 鏂囦欢',
      filters: [{ name: 'PlotFlow 鏁呬簨鏂囦欢', extensions: ['mdstory'] }],
      defaultPath: 'untitled.mdstory',
    });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, content, 'utf-8');
    return { filePath: result.filePath };
  });

  // 璇诲彇鏂囦欢锛堝凡鐭ヨ矾寰勶級
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, filePath: string) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content };
  });

  // 妫€鏌ユ枃浠跺瓨鍦?  ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (_event, filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });
}
```

### 4.2 鑷姩淇濆瓨绠＄悊鍣?
```typescript
// src-electron/services/auto-saver.ts

class AutoSaveManager {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs = 500;
  private pendingContent: string | null = null;
  private pendingPath: string | null = null;

  /** 鎺ユ敹鏉ヨ嚜 renderer 鐨勪繚瀛樿姹?*/
  onContentChanged(filePath: string, content: string): void {
    this.pendingContent = content;
    this.pendingPath = filePath;

    if (this.saveTimer) clearTimeout(this.saveTimer);

    this.saveTimer = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  /** 寮哄埗绔嬪嵆淇濆瓨 */
  async flush(): Promise<void> {
    if (!this.pendingContent || !this.pendingPath) return;

    try {
      await fs.writeFile(this.pendingPath, this.pendingContent, 'utf-8');
      // 閫氱煡 renderer 淇濆瓨鎴愬姛
      mainWindow.webContents.send('save:completed', { timestamp: Date.now() });
    } catch (error) {
      mainWindow.webContents.send('save:failed', { error: (error as Error).message });
    }
  }

  /** 澶栭儴鏂囦欢鍙樺寲妫€娴嬶紙濡?git pull锛?*/
  startWatch(filePath: string): void {
    fs.watch(filePath, (eventType) => {
      if (eventType === 'change') {
        mainWindow.webContents.send('file:external-change', { filePath });
      }
    });
  }

  dispose(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
  }
}
```

### 4.3 鍘熺敓鑿滃崟鏋勫缓鍣?
```typescript
// src-electron/services/menu-builder.ts

function buildAppMenu(): Electron.Menu {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: '鏂囦欢',
      submenu: [
        { label: '鏂板缓', accelerator: 'Ctrl+N', click: () => sendToRenderer('menu:new') },
        { label: '鎵撳紑...', accelerator: 'Ctrl+O', click: () => sendToRenderer('menu:open') },
        { type: 'separator' },
        { label: '淇濆瓨', accelerator: 'Ctrl+S', click: () => sendToRenderer('menu:save') },
        { label: '鍙﹀瓨涓?..', accelerator: 'Ctrl+Shift+S', click: () => sendToRenderer('menu:saveAs') },
        { type: 'separator' },
        {
          label: '浠庢ā鏉挎柊寤?,
          submenu: [
            { label: 'RPG 瀵硅瘽妯℃澘', click: () => sendToRenderer('menu:new-template', 'rpg') },
            { label: '瑙嗚灏忚妯℃澘', click: () => sendToRenderer('menu:new-template', 'visual-novel') },
            { label: '瑙ｈ皽娓告垙妯℃澘', click: () => sendToRenderer('menu:new-template', 'puzzle') },
            { label: 'Godot 绀轰緥椤圭洰', click: () => sendToRenderer('menu:new-template', 'godot') },
          ],
        },
        { type: 'separator' },
        { label: '閫€鍑?, role: 'quit' },
      ],
    },
    {
      label: '缂栬緫',
      submenu: [
        { label: '鎾ら攢', accelerator: 'Ctrl+Z', role: 'undo' },
        { label: '閲嶅仛', accelerator: 'Ctrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: '鏌ユ壘', accelerator: 'Ctrl+F', click: () => sendToRenderer('menu:find') },
        { label: '鍏ㄥ眬鎼滅储', accelerator: 'Ctrl+Shift+F', click: () => sendToRenderer('menu:searchAll') },
        { label: '璺宠浆鍒拌妭鐐?..', accelerator: 'Ctrl+G', click: () => sendToRenderer('menu:goto-node') },
        { type: 'separator' },
        {
          label: '鎻掑叆',
          submenu: [
            { label: '鎻掑叆閫夐」', accelerator: 'Ctrl+Shift+O', click: () => sendToRenderer('menu:insert-option') },
            { label: '鎻掑叆鑺傜偣', accelerator: 'Ctrl+Shift+N', click: () => sendToRenderer('menu:insert-node') },
          ],
        },
      ],
    },
    {
      label: '瑙嗗浘',
      submenu: [
        { label: '澶х翰瑙嗗浘', type: 'checkbox', checked: true, click: () => sendToRenderer('menu:toggle-outline') },
        { label: '闂闈㈡澘', accelerator: 'Ctrl+Shift+M', click: () => sendToRenderer('menu:toggle-problems') },
        { type: 'separator' },
        { label: '鍒囨崲涓婚', accelerator: 'Ctrl+Shift+T', click: () => sendToRenderer('menu:toggle-theme') },
        { type: 'separator' },
        { label: '鏀惧ぇ', accelerator: 'Ctrl+=', role: 'zoomIn' },
        { label: '缂╁皬', accelerator: 'Ctrl+-', role: 'zoomOut' },
        { label: '閲嶇疆缂╂斁', accelerator: 'Ctrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: '瀵煎嚭',
      submenu: [
        // V0.1: 瀵煎嚭鏍煎紡
        { label: '瀵煎嚭 JSON...', accelerator: 'Ctrl+Shift+J', click: () => sendToRenderer('menu:export-json') },
        { label: '瀵煎嚭 HTML...', accelerator: 'Ctrl+Shift+H', click: () => sendToRenderer('menu:export-html') },
        { label: '瀵煎嚭 TXT...', accelerator: 'Ctrl+Shift+E', click: () => sendToRenderer('menu:export-txt') },
        { type: 'separator' },
        // 寮曟搸闆嗘垚锛圴0.1 Godot 瀹屾暣锛屽叾浣欐爣娉ㄧ増鏈級
        { label: '瀵煎嚭鍒?Godot 椤圭洰...', click: () => sendToRenderer('menu:export-godot') },
        { label: '瀵煎嚭鍒?Unity 椤圭洰... (V0.2)', enabled: false, click: () => {} },
        { label: '瀵煎嚭鍒?Unreal 椤圭洰... (V0.3)', enabled: false, click: () => {} },
      ],
    },
    {
      label: '甯姪',
      submenu: [
        { label: '璇硶鎵嬪唽', click: () => sendToRenderer('menu:help-syntax') },
        { label: '妯℃澘鎸囧崡', click: () => sendToRenderer('menu:help-templates') },
        { label: '鍙嶉涓庣ぞ缇?, click: () => sendToRenderer('menu:help-feedback') },
        { type: 'separator' },
        { label: '鍏充簬 PlotFlow', click: () => sendToRenderer('menu:help-about') },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
```

### 4.4 鏂囦欢鍏宠仈 (.mdstory)

```typescript
// src-electron/services/file-association.ts
// 鍦?electron-builder 閰嶇疆涓０鏄庢枃浠跺叧鑱?
// package.json (electron-builder config)
// "fileAssociations": [
//   {
//     "ext": "mdstory",
//     "name": "PlotFlow Story File",
//     "description": "PlotFlow 鍙欎簨鍒嗘敮鑴氭湰",
//     "mimeType": "text/markdown; variant=plotflow",
//     "role": "Editor"
//   }
// ]

// Windows: 娉ㄥ唽琛?HKEY_CLASSES_ROOT\.mdstory 鈫?PlotFlow.exe "%1"
// macOS: Info.plist CFBundleDocumentTypes
// Linux: .desktop 鏂囦欢 MimeType 鏉＄洰

function handleFileOpen(app: Electron.App): void {
  // macOS: open-file 浜嬩欢
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    openFileInWindow(filePath);
  });

  // Windows: process.argv 涓殑绗簩涓弬鏁?  const filePath = process.argv.find(arg => arg.endsWith('.mdstory'));
  if (filePath) {
    openFileInWindow(filePath);
  }
}
```

### 4.5 绐楀彛鐘舵€佹寔涔呭寲

```typescript
// src-electron/services/window-state.ts

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

class WindowStateManager {
  private statePath: string;
  private defaultState: WindowState = { width: 1400, height: 900, isMaximized: false };

  constructor() {
    this.statePath = path.join(app.getPath('userData'), 'window-state.json');
  }

  async load(): Promise<WindowState> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      return { ...this.defaultState, ...JSON.parse(data) };
    } catch {
      return { ...this.defaultState };
    }
  }

  async save(win: BrowserWindow): Promise<void> {
    const bounds = win.getBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized(),
    };
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    await fs.writeFile(this.statePath, JSON.stringify(state), 'utf-8');
  }
}
```

---

## 5. 鏁版嵁娴佸浘 `[V0.1]`

### 5.1 鐢ㄦ埛杈撳叆鍒拌嚜鍔ㄤ繚瀛?
```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹?                   鐢ㄦ埛杈撳叆 鈫?鑷姩淇濆瓨                            鈹?鈹?                                                                 鈹?鈹? 閿洏杈撳叆                                                        鈹?鈹?    鈹?                                                           鈹?鈹?    鈻?                                                           鈹?鈹? Monaco Editor.onDidChangeModelContent()                         鈹?鈹?    鈹?                                                           鈹?鈹?    鈹溾攢鈹€鈫?useEditorStore.setRawMarkdown(text)  [鍗虫椂, 鏃?debounce]鈹?鈹?    鈹溾攢鈹€鈫?useEditorStore.markDirty()                              鈹?鈹?    鈹斺攢鈹€鈫?鍚姩 500ms debounce timer                               鈹?鈹?             鈹?                                                  鈹?鈹?             鈻?(500ms 鍚?                                        鈹?鈹?        鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?               鈹?鈹?        鈹? debounceHandler()                    鈹?               鈹?鈹?        鈹?                                      鈹?               鈹?鈹?        鈹? 1. parsePlotFlow(text)               鈹?               鈹?鈹?        鈹?    鈹斺攢鈹€鈫?useStoryStore.setPlotFlowData鈹?               鈹?鈹?        鈹?                                      鈹?               鈹?鈹?        鈹? 2. validate(data, text)              鈹?               鈹?鈹?        鈹?    鈹斺攢鈹€鈫?useValidatorStore.validate() 鈹?               鈹?鈹?        鈹?                                      鈹?               鈹?鈹?        鈹? 3. syncDiagnosticsToMonaco()         鈹?               鈹?鈹?        鈹?    鈹斺攢鈹€鈫?monaco.setModelMarkers()     鈹?               鈹?鈹?        鈹?                                      鈹?               鈹?鈹?        鈹? 4. useGraphStore.syncFromAST(data)   鈹?               鈹?鈹?        鈹?    鈹斺攢鈹€鈫?ReactFlow 閲嶆柊娓叉煋            鈹?               鈹?鈹?        鈹?                                      鈹?               鈹?鈹?        鈹? 5. requestCompletion(context)        鈹?               鈹?鈹?        鈹?    鈹斺攢鈹€鈫?寮傛 Worker 绾跨▼璁＄畻          鈹?               鈹?鈹?        鈹?                                      鈹?               鈹?鈹?        鈹? 6. ipcRenderer.invoke('file:save')   鈹?               鈹?鈹?        鈹?    鈹斺攢鈹€鈫?Electron Main Process        鈹?               鈹?鈹?        鈹?        鈹斺攢鈹€鈫?fs.writeFile()           鈹?               鈹?鈹?        鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?               鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

### 5.2 AST 鏇存柊鍒?UI 鍒锋柊

```
PlotFlowData AST (useStoryStore)
        鈹?        鈹溾攢鈹€鈫?鐩存帴椹卞姩 鈹€鈹€鈫?OutlineView
        鈹?                 (璇诲彇 chapters[].nodes[], 娓叉煋鑺傜偣鏍?
        鈹?        鈹溾攢鈹€鈫?useGraphStore.syncFromAST()
        鈹?       鈹?        鈹?       鈹溾攢鈹€鈫?Dagre 甯冨眬璁＄畻
        鈹?       鈹?    鈹?        鈹?       鈹?    鈹斺攢鈹€鈫?nodes[] / edges[] (React Flow 鏍煎紡)
        鈹?       鈹?          鈹?        鈹?       鈹?          鈹斺攢鈹€鈫?ReactFlowGraph 閲嶆柊娓叉煋
        鈹?       鈹?                鈹溾攢鈹€鈫?StoryNode (鑷畾涔夎妭鐐?
        鈹?       鈹?                鈹溾攢鈹€鈫?ConditionEdge / UnconditionalEdge
        鈹?       鈹?                鈹斺攢鈹€鈫?鑺傜偣鐘舵€佺潃鑹?(妫€鏌?diagnostic)
        鈹?       鈹?        鈹?       鈹斺攢鈹€鈫?Minimap 鏇存柊
        鈹?        鈹溾攢鈹€鈫?useValidatorStore.validate()
        鈹?       鈹?        鈹?       鈹溾攢鈹€鈫?diagnostics[] (瀹屾暣鍒楄〃)
        鈹?       鈹溾攢鈹€鈫?diagnosticsByNode (鎸夎妭鐐瑰垎缁?
        鈹?       鈹溾攢鈹€鈫?diagnosticsByLine (鎸夎鍙峰垎缁?
        鈹?       鈹?        鈹?       鈹溾攢鈹€鈫?syncDiagnosticsToMonaco()
        鈹?       鈹?    鈹斺攢鈹€鈫?monaco.setModelMarkers() 鈫?娉㈡氮绾?        鈹?       鈹?        鈹?       鈹溾攢鈹€鈫?ProblemsPanel (鍒楄〃鏄剧ず)
        鈹?       鈹?        鈹?       鈹溾攢鈹€鈫?OutlineView (鑺傜偣鐘舵€佸浘鏍?
        鈹?       鈹?        鈹?       鈹斺攢鈹€鈫?StatusBar (diagnosticSummary: 馃敶3 馃煛2 馃數1)
        鈹?        鈹溾攢鈹€鈫?useCompletionStore.requestCompletion()
        鈹?       鈹?        鈹?       鈹溾攢鈹€鈫?detectTrigger() (鍩轰簬鍏夋爣浣嶇疆+鏂囨湰)
        鈹?       鈹溾攢鈹€鈫?NGramEngine.predict()
        鈹?       鈹?    鈹斺攢鈹€鈫?CompletionSuggestion[]
        鈹?       鈹?        鈹?       鈹斺攢鈹€鈫?MonacoCompletionAdapter
        鈹?             鈹斺攢鈹€鈫?InlineCompletionItemProvider
        鈹?                   鈹斺攢鈹€鈫?骞界伒瀛楃鏄剧ず
        鈹?        鈹斺攢鈹€鈫?StatusBar
                 鈹斺攢鈹€鈫?nodeStats (鑺傜偣鏁?閫夐」鏁?
```

### 5.3 瀵煎嚭 Pipeline 鏁版嵁娴?
```
鐢ㄦ埛瑙﹀彂瀵煎嚭 (Ctrl+E / 鑿滃崟)
        鈹?        鈻? ExportDialog (閫夋嫨鏍煎紡: JSON/HTML/TXT)
        鈹?        鈻? useStoryStore.getState().plotFlowData  鈫?AST
        鈹?        鈻? ExportManager.export(data, config)
        鈹?        鈹溾攢鈹€ config.format === 'json'
        鈹?    鈹斺攢鈹€鈫?JSONExporter.export()
        鈹?          鈹?        鈹?          鈹溾攢鈹€鈫?serializeVariables()
        鈹?          鈹溾攢鈹€鈫?serializeChapters() (鍚?AST)
        鈹?          鈹斺攢鈹€鈫?JSON.stringify() 鈫?.json 鏂囦欢
        鈹?        鈹溾攢鈹€ config.format === 'html'
        鈹?    鈹斺攢鈹€鈫?HTMLExporter.export()
        鈹?          鈹?        鈹?          鈹溾攢鈹€鈫?鍐呭祵 CSS (涓婚鍙橀噺)
        鈹?          鈹溾攢鈹€鈫?鍐呭祵 JavaScript (浜や簰寮曟搸)
        鈹?          鈹溾攢鈹€鈫?搴忓垪鍖?PlotFlowData 鈫?JS 瀵硅薄
        鈹?          鈹斺攢鈹€鈫?鎷兼帴瀹屾暣 HTML 鈫?.html 鏂囦欢
        鈹?        鈹溾攢鈹€ config.format === 'txt'
        鈹?    鈹斺攢鈹€鈫?TXTExporter.export()
        鈹?          鈹?        鈹?          鈹溾攢鈹€鈫?閬嶅巻鎵€鏈夎妭鐐?        鈹?          鈹溾攢鈹€鈫?鎻愬彇姝ｆ枃 + 閫夐」鏂囨湰
        鈹?          鈹斺攢鈹€鈫?绾枃鏈嫾鎺?鈫?.txt 鏂囦欢
        鈹?        鈹斺攢鈹€ config.format === 'godot' | 'unity' | 'unreal'
              鈹斺攢鈹€鈫?EnginePlugin.exportForEngine()
                    鈹?                    鈹溾攢鈹€鈫?寮曟搸涓撳睘 JSON 杞崲
                    鈹斺攢鈹€鈫?杈撳嚭鍒板紩鎿庨」鐩洰褰?```

---

## 6. 绫诲瀷绯荤粺 `[V0.1]`

### 6.1 瀹屾暣 TypeScript 鎺ュ彛瀹氫箟

```typescript
// ============================================================
// @plotflow/parser/src/types.ts
// 鏍稿績绫诲瀷 鈥?涓?PRD JSON Schema 瀵归綈
// ============================================================

/** 椤跺眰鏁版嵁缁撴瀯 */
interface PlotFlowData {
  meta: PlotFlowMeta;
  variables: VariableDefinitions;       // Map<string, VariableDefinition>
  chapters: Chapter[];
}

interface PlotFlowMeta {
  plotflow: string;                     // 鐗堟湰鍙?e.g. '0.1'
  title: string;
  author?: string;
  engine?: 'godot' | 'unity' | 'unreal' | 'none';
}

/** 鍙橀噺瀹氫箟 */
interface VariableDefinitions {
  [name: string]: VariableDefinition;
}

type VariableType = 'int' | 'float' | 'bool' | 'string' | 'enum' | 'object';
type VariableScope = 'global' | 'chapter';

interface VariableDefinition {
  name: string;
  type: VariableType;
  scope: VariableScope;
  default?: unknown;
  // enum 涓撳睘
  values?: string[];
  // object 涓撳睘
  fields?: Record<string, VariableDefinition>;
  // 宓屽娣卞害锛堣绠楀€硷紝鐢ㄤ簬妫€娴?E006锛?  nestingDepth?: number;
  // 鎵€灞炵珷鑺傦紙scope='chapter' 鏃讹級
  chapterId?: string;
  // 鍏冩暟鎹?  description?: string;
}

/** 绔犺妭 */
interface Chapter {
  id: string;                           // 绔犺妭 ID锛堜笌 title 鐩稿悓锛?  title: string;                        // 绔犺妭鏍囬
  nodes: StoryNode[];                   // 鏈珷鐨勮妭鐐瑰垪琛?}

/** 鏁呬簨鑺傜偣 */
interface StoryNode {
  id: string;                           // 鑺傜偣 ID锛堜笉鍚珷鑺傚墠缂€锛?  chapterId: string;                    // 鎵€灞炵珷鑺?ID
  fullId: string;                       // 鍏ㄥ眬鍞竴 ID: "绔犺妭ID/鑺傜偣ID"
  title: string;                        // 鑺傜偣鏍囬锛堢函鏂囨湰锛屼笉鍚?鑺傜偣锛?鍓嶇紑锛?  body: string[];                       // 鎻忚堪鏂囨湰鏁扮粍锛堟寜娈佃惤锛?  options: Option[];                    // 閫夐」鍒楄〃
  position: { x: number; y: number };  // 鍒嗘敮鍥句綅缃?  // 璇婃柇鏍囪锛堢敱 Validator 璁＄畻锛?  isRoot: boolean;                      // 鏄惁涓虹涓€涓妭鐐?  isOrphan: boolean;                    // 鏄惁瀛ょ珛
  isDeadEnd: boolean;                   // 鏄惁姝昏儭鍚?}

/** 閫夐」 */
interface Option {
  index: number;                        // 鍦ㄨ妭鐐瑰唴鐨勫簭鍙凤紙0-based锛?  text: string;                         // 閫夐」鎻忚堪鏂囨湰
  targetNodeId: string;                 // 璺宠浆鐩爣鑺傜偣 ID锛堜笉鍚珷鑺傚墠缂€锛?  targetChapterId?: string;             // 璺宠浆鐩爣绔犺妭锛堣法绔犺妭寮曠敤鏃讹級
  targetFullId: string;                 // 璺宠浆鐩爣鍏ㄥ眬 ID锛堣В鏋愬櫒鑷姩琛ュ叏锛?  // 鏉′欢锛堝彲閫夛級
  conditions: Condition | null;
  // 鍙橀噺鍓綔鐢紙鍙€夛級
  sideEffects: SideEffect[];
  // 婧愮爜浣嶇疆
  location?: SourceLocation;
}

/** 鏉′欢琛ㄨ揪寮?*/
interface Condition {
  /** 鍘熷鏂囨湰琛ㄨ揪寮?*/
  expression: string;
  /** 瑙ｆ瀽鍚庣殑 AST锛堣В鏋愬け璐ユ椂涓?null锛?*/
  ast: ConditionAST | null;
  /** 瑙ｆ瀽閿欒淇℃伅 */
  parseError?: string;
}

/** 鏉′欢 AST 鑺傜偣绫诲瀷 */
type ConditionAST =
  | ConditionComparison
  | ConditionLogicalAnd
  | ConditionLogicalOr
  | ConditionLogicalNot;

interface ConditionComparison {
  type: 'comparison';
  variable: string;                     // 鍙橀噺鍚嶏紙鏀寔鐐瑰彿璁块棶: '瑙掕壊.鑱屼笟'锛?  operator: ComparisonOperator;
  value: string | number | boolean;
}

type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';

interface ConditionLogicalAnd {
  type: 'logical_and';
  left: ConditionAST;
  right: ConditionAST;
}

interface ConditionLogicalOr {
  type: 'logical_or';
  left: ConditionAST;
  right: ConditionAST;
}

interface ConditionLogicalNot {
  type: 'logical_not';
  operand: ConditionAST;
}

/** 鍙橀噺鍓綔鐢?*/
interface SideEffect {
  variable: string;                     // 鍙橀噺鍚嶏紙鏀寔鐐瑰彿璁块棶锛?  operation: SideEffectOperation;
  value: unknown;                       // 鍊肩被鍨嬪彇鍐充簬鍙橀噺绫诲瀷
}

type SideEffectOperation = 'set' | 'add' | 'subtract' | 'append';

/** 婧愮爜浣嶇疆 */
interface SourceLocation {
  startLine: number;                    // 1-based
  startColumn: number;                  // 1-based
  endLine: number;
  endColumn: number;
}

// ============================================================
// Validator 绫诲瀷
// ============================================================

type DiagnosticLevel = 'error' | 'warning' | 'info';

interface Diagnostic {
  /** 诊断编号: E001-E008, W001-W007, I001-I003 */
  code: string;
  level: DiagnosticLevel;
  /** 浜虹被鍙鎻忚堪 */
  message: string;
  /** 婧愮爜浣嶇疆 */
  location: SourceLocation;
  /** 鍏宠仈鐨勮妭鐐?fullId */
  nodeId?: string;
  /** 淇寤鸿鏂囨湰 */
  suggestion?: string;
  /** 涓€閿慨澶嶅姩浣?*/
  quickFix?: QuickFix;
}

interface QuickFix {
  label: string;
  action: 'create-node' | 'add-variable' | 'add-default-option' | 'jump-to' | 'fix-format';
  payload: Record<string, unknown>;
}

interface DiagnosticCounts {
  errors: number;
  warnings: number;
  infos: number;
}

// ============================================================
// Exporter 绫诲瀷
// ============================================================

type ExportFormat = 'json' | 'html' | 'txt' | 'godot' | 'unity' | 'unreal';

interface ExportConfig {
  format: ExportFormat;
  pretty?: boolean;
  includeDiagnostics?: boolean;
  targetEngine?: 'godot' | 'unity' | 'unreal';
  htmlTheme?: 'dark' | 'light';
  outputPath?: string;
  formatVersion?: string;              // schema 鐗堟湰
}

interface ExportResult {
  success: boolean;
  content: string;
  fileName: string;
  warnings?: string[];
  errors?: string[];
}

interface IExporter {
  readonly format: ExportFormat;
  readonly extension: string;
  readonly mimeType: string;
  export(data: PlotFlowData, config: ExportConfig): ExportResult;
}

// ============================================================
// JSON 瀵煎嚭 Schema 绫诲瀷锛堜笌 PRD 搂8.2 瀵归綈锛?// ============================================================

interface StoryJSON {
  $schema: string;
  meta: {
    plotflow: string;
    title: string;
    author?: string;
    engine?: string;
    exportedAt: string;
  };
  variables: Record<string, SerializedVariable>;
  chapters: SerializedChapter[];
}

interface SerializedVariable {
  type: string;
  default: unknown;
  scope: 'global' | 'chapter';
  values?: string[];
  fields?: Record<string, SerializedVariable>;
  chapter?: string;
}

interface SerializedChapter {
  id: string;
  title: string;
  nodes: SerializedNode[];
}

interface SerializedNode {
  id: string;
  chapterId: string;
  fullId: string;
  title: string;
  body: string[];
  options: SerializedOption[];
  position: { x: number; y: number };
  isRoot: boolean;
  isOrphan: boolean;
  isDeadEnd: boolean;
}

interface SerializedOption {
  index: number;
  text: string;
  targetNodeId: string;
  targetFullId: string;
  conditions: SerializedCondition | null;
  sideEffects: SerializedSideEffect[];
}

interface SerializedCondition {
  expression: string;
  ast: ConditionAST | null;
}

interface SerializedSideEffect {
  variable: string;
  operation: string;                   // 'set' | 'add' | 'subtract' | 'append'
  value: unknown;
}

// ============================================================
// Completion 绫诲瀷
// ============================================================

type CompletionDimension = 'node-title' | 'option-text' | 'body-text' | 'variable-name';

interface CompletionContext {
  dimension: CompletionDimension;
  prefix: string;
  contextBefore: string;
  contextAfter?: string;
  currentNodeTitle?: string;
  existingOptions?: string[];
  availableVariables?: string[];
  cursorPosition: { line: number; column: number };
}

interface CompletionSuggestion {
  text: string;                         // 琛ュ叏鏂囨湰
  score: number;                        // 缃俊搴﹀垎鏁?  source: 'baseline' | 'user' | 'imported' | 'variable';
  metadata?: {
    frequency?: number;
    dimension?: CompletionDimension;
  };
}

// ============================================================
// React Flow 绫诲瀷
// ============================================================

type NodeStatus = 'normal' | 'orphan' | 'deadend' | 'error' | 'selected';

interface StoryFlowNode {
  id: string;
  type: 'storyNode';
  position: { x: number; y: number };
  data: {
    id: string;
    title: string;
    preview: string;
    optionCount: number;
    status: NodeStatus;
    isRoot: boolean;
    onClick: (id: string) => void;
    onDoubleClick: (id: string) => void;
  };
}

interface StoryFlowEdge {
  id: string;
  source: string;
  target: string;
  type: 'conditionEdge' | 'unconditionalEdge';
  data: {
    isConditional: boolean;
    conditionText?: string;
    optionIndex?: number;
  };
}

// ============================================================
// Electron / IPC 绫诲瀷
// ============================================================

interface PlotFlowAPI {
  file: {
    open: () => Promise<{ filePath: string; content: string } | null>;
    save: (filePath: string, content: string) => Promise<{ success: boolean }>;
    saveAs: (content: string) => Promise<{ filePath: string } | null>;
    read: (filePath: string) => Promise<{ content: string }>;
    exists: (filePath: string) => Promise<boolean>;
    getRecent: () => Promise<RecentFileEntry[]>;
  };
  dialog: {
    showExport: (defaultName: string) => Promise<string | null>;
    showConfirm: (message: string) => Promise<boolean>;
  };
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
}

interface RecentFileEntry {
  filePath: string;
  fileName: string;
  lastOpenedAt: string;                // ISO 8601
}

// ============================================================
// 寮曟搸鎻掍欢鎺ュ彛绫诲瀷
// ============================================================

interface IEnginePlugin {
  readonly name: string;
  readonly engine: 'godot' | 'unity' | 'unreal';
  exportForEngine(data: PlotFlowData, config: EngineExportConfig): string;
  readEngineVariables?(projectPath: string): EngineVariable[];
  isInstalledInProject?(projectPath: string): boolean;
}

interface EngineExportConfig {
  projectPath: string;
  outputDir: string;
  includeRuntimeLibs?: boolean;
}

interface EngineVariable {
  name: string;
  type: string;
  defaultValue: unknown;
  description?: string;
}

// ============================================================
// Frontmatter 瑙ｆ瀽涓棿绫诲瀷
// ============================================================

interface FrontmatterData {
  plotflow?: string;
  title?: string;
  author?: string;
  engine?: string;
  vars?: Record<string, unknown>;
}
```

---

## 7. 鎬ц兘璁捐 `[V0.1]`

### 7.1 闃叉姈绛栫暐璇﹁В

| 浜嬩欢 | 闃叉姈鏃堕棿 | 鐞嗙敱 | 澶勭悊鍐呭 |
|------|---------|------|---------|
| **缂栬緫鍣ㄥ唴瀹瑰彉鏇?* | **500ms** | Monaco 鍙樻洿棰戠箒锛堟瘡娆℃寜閿級锛?00ms 鏄綋鎰?鍋滄杈撳叆"鐨勬椂闂寸偣 | 鍏ㄧ绾匡細瑙ｆ瀽 鈫?楠岃瘉 鈫?鍒嗘敮鍥?鈫?琛ュ叏 鈫?淇濆瓨 |
| **琛ュ叏瑙﹀彂** | **200ms** | 鐢ㄦ埛杈撳叆鏈夊仠椤挎墠瑙﹀彂锛岄伩鍏嶆瘡娆℃寜閿兘璁＄畻 N-gram 鍖归厤 | 妫€娴嬭Е鍙戜笂涓嬫枃 鈫?N-gram 棰勬祴 |
| **骞界伒瀛楃鍒锋柊** | 瀹炴椂锛堟棤寤惰繜锛?| 骞界伒瀛楃璺熼殢鍏夋爣鏄剧ず锛孴ab 鎺ュ彈闇€瑕佸嵆鏃跺搷搴?| 鏄剧ず/闅愯棌/鏇挎崲 ghost text |
| **鍒嗘敮鍥炬嫋鎷?* | **50ms** | 鎷栨嫿杩炵嚎闇€瑕佹祦鐣呭弽棣?| 棰勮杩炵嚎 鈫?鏉炬墜鍚庢墠瑙﹀彂 AST 淇敼 |
| **鑷姩淇濆瓨** | **500ms** (鐙珛璁℃椂鍣? | 涓庣紪杈戝櫒 debounce 鍏辩敤鍚屼竴涓?timer锛岃В鏋愬拰淇濆瓨涓€娆″畬鎴?| 鍐欏叆 .mdstory 鏂囦欢 |

```typescript
// debounce-manager.ts
class DebounceManager {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  debounce(key: string, fn: () => void, ms: number): void {
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      fn();
    }, ms));
  }

  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /** 缂栬緫鍣ㄥ彉鏇? 绔嬪嵆鎵ц涓€閮ㄥ垎锛屽欢杩熸墽琛屼竴閮ㄥ垎 */
  onEditorChange(text: string): void {
    // 鍗虫椂: 鏇存柊缂栬緫鍣?store
    useEditorStore.getState().setRawMarkdown(text);
    useEditorStore.getState().markDirty();

    // 500ms 寤惰繜: 鍏ㄧ绾?    this.debounce('editor-parse', () => {
      const data = parsePlotFlow(text).data;
      useStoryStore.getState().setPlotFlowData(data);
      useValidatorStore.getState().validate(data, text);
      useGraphStore.getState().syncFromAST(data);

      // 鍚屾璇婃柇鍒?Monaco
      const model = useEditorStore.getState().monacoModel;
      if (model) {
        syncDiagnosticsToMonaco(model, useValidatorStore.getState().diagnostics, text);
      }

      // 鑷姩淇濆瓨
      const filePath = useUIStore.getState().activeFilePath;
      if (filePath) {
        window.plotflow.file.save(filePath, text);
      }
    }, 500);
  }
}
```

### 7.2 React Flow 铏氭嫙鍖栵紙200+ 鑺傜偣锛?
```typescript
// 绛栫暐: 鍒╃敤 React Flow 鍐呯疆鐨勮妭鐐瑰彲瑙佹€ц绠?+ 鑷畾涔変紭鍖?
// 1. React Flow 榛樿浠呭湪瑙嗗彛鍐呯殑鑺傜偣娓叉煋 DOM
//    鈫?閫氳繃 <ReactFlow onlyRenderVisibleElements={true} /> 鍚敤

// 2. 瓒呰繃 200 鑺傜偣鏃惰嚜鍔ㄥ惎鐢ㄦ姌鍙?//    鈫?鍚屽眰鑺傜偣瓒呰繃 20 涓椂锛屾按骞虫姌鍙犱负 "N 涓妭鐐?.." 缇ょ粍

// 3. 甯冨眬缂撳瓨: Dagre 甯冨眬缁撴灉缂撳瓨锛屼粎鍦ㄨ妭鐐瑰鍒犳椂閲嶆柊璁＄畻
let layoutCache: Map<string, { nodes: StoryFlowNode[]; edges: StoryFlowEdge[] }> = new Map();

function getOrComputeLayout(data: PlotFlowData): { nodes: StoryFlowNode[]; edges: StoryFlowEdge[] } {
  const key = hashPlotFlowData(data);  // 鍩轰簬鑺傜偣 ID 鍒楄〃鍜岃繛鎺ュ叧绯荤殑鍝堝笇
  if (layoutCache.has(key)) {
    return layoutCache.get(key)!;
  }
  const result = layoutNodes(data.chapters);
  layoutCache.set(key, result);

  // 闄愬埗缂撳瓨澶у皬
  if (layoutCache.size > 10) {
    const firstKey = layoutCache.keys().next().value;
    layoutCache.delete(firstKey);
  }
  return result;
}

// 4. React Flow 娓叉煋閰嶇疆
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  onlyRenderVisibleElements={true}   // 浠呮覆鏌撹鍙ｅ唴鑺傜偣
  minZoom={0.1}
  maxZoom={2.0}
  defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
  fitView={nodes.length <= 50}       // 鈮?0鑺傜偣鏃跺垵濮?fitView
  fitViewOptions={{ padding: 0.2 }}
  proOptions={{ hideAttribution: true }}
>
  <Background />
  <Controls />
  <MiniMap
    nodeColor={getMiniMapColor}
    maskColor="rgba(0,0,0,0.2)"
  />
</ReactFlow>

// 5. 鎬ц兘鐩爣楠岃瘉
//    200 鑺傜偣 / 1000 閫夐」 鈫?鈮?30fps
//    - 甯冨眬璁＄畻: < 100ms (Dagre 宸茬煡蹇?
//    - React Flow diff: < 50ms
//    - 鎬荤绾? parse(50ms) + layout(100ms) + render(50ms) = ~200ms
```

### 7.3 Monaco 澶ф枃浠跺鐞?
```typescript
// Monaco Editor 榛樿瀵?10MB 浠ュ唴鐨勬枃浠舵€ц兘鑹ソ
// PlotFlow 鐨?.mdstory 鏂囦欢閫氬父杩滃皬浜庢锛?500KB锛?
// 閰嶇疆閫夐」:
const monacoOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  // 绂佺敤瀵硅秴澶ф枃浠朵笉蹇呰鐨勫姛鑳?  wordWrap: 'on',                     // 鑷姩鎹㈣锛岄伩鍏嶆按骞虫粴鍔?  minimap: { enabled: false },        // 鍏抽棴灏忓湴鍥撅紙鏂囨湰缂栬緫鍣ㄤ笉闇€瑕侊級
  lineNumbers: 'on',
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: false },  // PlotFlow 璇硶涓嶉渶瑕佹嫭鍙风潃鑹?  matchBrackets: 'never',             // 鍏抽棴鎷彿鍖归厤锛堝噺灏戝紑閿€锛?  autoClosingBrackets: 'never',       // 鑷繁绠＄悊 `[閫夐」]` 鐨勯棴鍚?  folding: true,                      // 鑺傜偣鎶樺彔
  foldingStrategy: 'indentation',     // 鍩轰簬缂╄繘鎶樺彔锛堣妭鐐瑰潡鑷劧缂╄繘锛?  scrollBeyondLastLine: false,
  renderLineHighlight: 'line',
  cursorBlinking: 'smooth',
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
};

// 瀵逛簬瓒呰繃 1MB 鐨勬枃浠讹紙鏋佸皯鎯呭喌锛夛細
// 鍚敤 Monaco 鐨?largeFileOptimizations
if (content.length > 1024 * 1024) {
  Object.assign(monacoOptions, {
    largeFileOptimizations: true,
    maxTokenizationLineLength: 1000,
    renderIndentGuides: false,
  });
}
```

### 7.4 琛ュ叏寮曟搸寮傛 Worker 璁捐

```typescript
// completion/completion-worker.ts
// 鍦?Web Worker 涓繍琛?N-gram 寮曟搸锛岄伩鍏嶉樆濉?UI 绾跨▼

// 涓荤嚎绋?(Renderer):
class CompletionWorkerManager {
  private worker: Worker;
  private pendingRequests: Map<string, {
    resolve: (result: CompletionSuggestion[]) => void;
    reject: (error: Error) => void;
  }> = new Map();

  constructor() {
    // 浣跨敤 Vite 鐨?Worker 瀵煎叆璇硶
    this.worker = new Worker(
      new URL('./completion-worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, result, error } = event.data;
      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(result!);
        }
      }
    };
  }

  predict(context: CompletionContext): Promise<CompletionSuggestion[]> {
    return new Promise((resolve, reject) => {
      const id = nanoid();
      this.pendingRequests.set(id, { resolve, reject });

      this.worker.postMessage({
        type: 'predict',
        id,
        payload: context,
      } as WorkerRequest);

      // 200ms 瓒呮椂
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve([]);  // 瓒呮椂杩斿洖绌?        }
      }, 200);
    });
  }

  train(text: string, source: string): Promise<void> {
    return new Promise((resolve) => {
      const id = nanoid();
      this.pendingRequests.set(id, {
        resolve: () => resolve(),
        reject: () => resolve(),
      });

      this.worker.postMessage({
        type: 'train',
        id,
        payload: { text, source },
      });
    });
  }

  /** 鍒濆鍖? 鍔犺浇棰勭疆璇枡 */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = nanoid();
      this.pendingRequests.set(id, {
        resolve: () => resolve(),
        reject: (err) => reject(err),
      });

      this.worker.postMessage({
        type: 'initialize',
        id,
        payload: null,
      });
    });
  }

  terminate(): void {
    this.worker.terminate();
  }
}

// Worker 绾跨▼:
// completion/completion-worker.ts
interface WorkerRequest {
  type: 'predict' | 'train' | 'initialize' | 'prune' | 'shutdown';
  id: string;
  payload: unknown;
}

interface WorkerResponse {
  id: string;
  result?: CompletionSuggestion[] | null;
  error?: string;
}

let engine: NGramEngine | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, id, payload } = event.data;

  try {
    switch (type) {
      case 'initialize': {
        // 鍔犺浇棰勭疆璇枡锛堜粠 IndexedDB 鎴栧帇缂╀簩杩涘埗鏂囦欢锛?        const corpusData = await loadBaselineCorpus();
        engine = new NGramEngine();

        for (const item of corpusData) {
          engine.train(item.text, 'baseline');
        }
        (self as any).postMessage({ id, result: null });
        break;
      }

      case 'train': {
        const { text, source } = payload as { text: string; source: string };
        engine?.train(text, source as any);
        (self as any).postMessage({ id, result: null });
        break;
      }

      case 'predict': {
        if (!engine) {
          (self as any).postMessage({ id, result: [] });
          break;
        }
        const context = payload as CompletionContext;
        const suggestions = engine.predict(context);
        (self as any).postMessage({ id, result: suggestions });
        break;
      }

      case 'prune': {
        engine?.prune();
        (self as any).postMessage({ id, result: null });
        break;
      }

      case 'shutdown': {
        self.close();
        break;
      }
    }
  } catch (error) {
    (self as any).postMessage({ id, error: (error as Error).message });
  }
};
```

### 7.5 鎬ц兘鐩爣涓庣洃鎺?
| 鎸囨爣 | 鐩爣鍊?| 娴嬮噺鏂规硶 |
|------|--------|---------|
| **缂栬緫鍣ㄥ搷搴?* | 杈撳叆鍒板瓧绗︽樉绀?< 16ms (60fps) | Monaco 鍐呯疆鎸囨爣 |
| **瑙ｆ瀽寤惰繜** | 500ms debounce 鍚庯紝瑙ｆ瀽 200 鑺傜偣鏂囦欢 < 100ms | `performance.now()` 鎵撶偣 |
| **楠岃瘉寤惰繜** | 200 鑺傜偣鏂囦欢鍏ㄩ噺楠岃瘉 < 50ms | `performance.now()` 鎵撶偣 |
| **Dagre 甯冨眬** | 200 鑺傜偣甯冨眬璁＄畻 < 100ms | `performance.now()` 鎵撶偣 |
| **鍒嗘敮鍥?FPS** | 200 鑺傜偣瑙嗗彛骞崇Щ 鈮?30fps | React DevTools Profiler |
| **琛ュ叏鍝嶅簲** | Worker 璁＄畻 + 鏄剧ず < 200ms锛堝惈 200ms 瓒呮椂锛?| Worker round-trip 璁℃椂 |
| **鑷姩淇濆瓨** | 鏂囦欢鍐欏叆 < 50ms锛堟枃鏈枃浠?< 500KB锛?| Node.js `fs.writeFile` 璁℃椂 |
| **鍚姩鏃堕棿** | 鍐峰惎鍔?< 3s锛堝惈 Electron 鍚姩 + 璇枡鍔犺浇锛?| 杩涚▼鍚姩鍒伴甯х殑鏃堕棿 |
| **鍐呭瓨鍗犵敤** | 200 鑺傜偣鏂囦欢缂栬緫涓?< 300MB | Chrome DevTools Memory |

---

## 闄勫綍 A: 渚濊禆鍥捐氨

```
@plotflow/monorepo (pnpm workspace)
鈹溾攢鈹€ packages/app (Electron + React)
鈹?  鈹溾攢鈹€ dependencies:
鈹?  鈹?  鈹溾攢鈹€ react@18.x
鈹?  鈹?  鈹溾攢鈹€ react-dom@18.x
鈹?  鈹?  鈹溾攢鈹€ reactflow@11.x
鈹?  鈹?  鈹溾攢鈹€ @dagrejs/dagre@1.x
鈹?  鈹?  鈹溾攢鈹€ monaco-editor@0.44+
鈹?  鈹?  鈹溾攢鈹€ @monaco-editor/react@4.x
鈹?  鈹?  鈹溾攢鈹€ zustand@4.x
鈹?  鈹?  鈹溾攢鈹€ unified@11.x
鈹?  鈹?  鈹溾攢鈹€ remark-parse@11.x
鈹?  鈹?  鈹溾攢鈹€ js-yaml@4.x
鈹?  鈹?  鈹溾攢鈹€ better-sqlite3@9.x (璇枡绱㈠紩)
鈹?  鈹?  鈹溾攢鈹€ radix-ui (鏃犻殰纰嶅師璇?
鈹?  鈹?  鈹斺攢鈹€ nanoid@5.x
鈹?  鈹溾攢鈹€ devDependencies:
鈹?  鈹?  鈹溾攢鈹€ electron@28.x
鈹?  鈹?  鈹溾攢鈹€ electron-builder@24.x
鈹?  鈹?  鈹溾攢鈹€ vite@5.x
鈹?  鈹?  鈹溾攢鈹€ vite-plugin-electron@0.x
鈹?  鈹?  鈹溾攢鈹€ vitest@1.x
鈹?  鈹?  鈹溾攢鈹€ playwright@1.x
鈹?  鈹?  鈹溾攢鈹€ typescript@5.x
鈹?  鈹?  鈹溾攢鈹€ eslint@8.x
鈹?  鈹?  鈹溾攢鈹€ prettier@3.x
鈹?  鈹?  鈹斺攢鈹€ @types/* ...
鈹?鈹溾攢鈹€ packages/parser (@plotflow/parser)
鈹?  鈹溾攢鈹€ dependencies:
鈹?  鈹?  鈹溾攢鈹€ unified@11.x
鈹?  鈹?  鈹溾攢鈹€ remark-parse@11.x
鈹?  鈹?  鈹斺攢鈹€ js-yaml@4.x
鈹?  鈹斺攢鈹€ devDependencies:
鈹?      鈹溾攢鈹€ vitest@1.x
鈹?      鈹斺攢鈹€ typescript@5.x
鈹?鈹斺攢鈹€ tests/
    鈹斺攢鈹€ fixtures/ (.mdstory 娴嬭瘯鏂囦欢)
```

## 闄勫綍 B: 鍏抽敭鎶€鏈€夊瀷鍐崇瓥璁板綍

| ADR | 鍐崇瓥 | 鐞嗙敱 |
|-----|------|------|
| ADR-001 | Electron 42 (闈?Tauri) | 褰撳墠鍙楁敮鎸佺ǔ瀹氱嚎锛孧onaco 瀹樻柟鏀寔锛孯eact Flow 瀹屽叏鍏煎锛岀幇鏈夎祫浜у鐢?|
| ADR-002 | React Flow + Dagre | MIT 鍗忚锛宯8n/TypeForm 鍚屾锛屽彲缂栬緫鑺傜偣鍥剧敓鎬佹渶鎴愮啛 |
| ADR-003 | Zustand (闈?Redux) | 杞婚噺锛岄€傚悎缂栬緫鍣ㄧ粏绮掑害鐘舵€侊紝TypeScript 鎺ㄦ柇鍙嬪ソ锛屾棤 boilerplate |
| ADR-004 | unified + remark (闈?marked) | 鎴愮啛 AST 鐢熸€侊紝鎻掍欢浣撶郴鏀寔鑷畾涔夎娉曟墿灞?|
| ADR-005 | Monarch Tokenizer (闈?TextMate) | Monaco 鍘熺敓澹版槑寮忔柟妗堬紝寮€绠卞嵆鐢紝TextMate 浣滀负 V0.2 澧炲己 |
| ADR-006 | better-sqlite3 (璇枡绱㈠紩浠? | 浠呯敤浜庤ˉ鍏ㄨ鏂欏厓鏁版嵁鍜岀储寮曪紝涓嶅瓨鍌?.mdstory 鍐呭 |
| ADR-007 | N-gram 缁熻妯″瀷 (闈?LLM) | 绾湰鍦帮紝闅愮瀹夊叏锛屾棤缃戠粶渚濊禆锛屾棤闇€ GPU锛?MB 璇枡鍗冲彲宸ヤ綔 |
| ADR-008 | Web Worker 琛ュ叏璁＄畻 | 閬垮厤闃诲 UI 绾跨▼锛?00ms 瓒呮椂淇濊瘉鍝嶅簲鎬?|
| ADR-009 | pnpm monorepo | 瑙ｆ瀽鍣ㄧ嫭绔嬩负 @plotflow/parser 鍖咃紝鍙 Godot 鎻掍欢鐩存帴寮曠敤 |

---

*鏈枃妗ｆ槸 PlotFlow V0.1 鐨勫畬鏁村疄鐜拌摑鍥俱€傛墍鏈夋ā鍧椼€佹帴鍙ｃ€佹暟鎹祦鍜岀被鍨嬪畾涔夊潎宸叉樉寮忓畾涔夈€傚紑鍙戞椂浠ユ湰鏂囨。涓烘潈濞佸弬鑰冿紝涓?PRD 鍐茬獊鏃朵互 PRD 涓哄噯銆?

