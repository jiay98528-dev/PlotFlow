# PlotFlow 实时进度跟踪

> **Architecture gate update (2026-07-06)**: six release risks are closed for source, integration, source-blackbox, and unpacked layers: shared `.mdstory` source ranges, unified Graph Lab writeback, worker-backed layout, current-file conflict hash state, TS/TSX token lint, and build/bundle consistency. Follow-up audit fixes also closed save preflight read-failure handling and React Flow `#number` id mapping. Verified gates: `lint:tokens`, `typecheck`, `test` (48 files / 1267 tests), `lint` (0 errors / 9 existing warnings), `lint:css`, `build`, `@plotflow/app build`, `lint:bundle`, Graph Lab narrow E2E (18/18), blackbox edge (5 passed / 3 skipped), full app E2E (49/49), source blackbox (10 passed / 4 skipped), `package:win`, and unpacked blackbox (13 passed / 1 installed-only skip). Installed blackbox and manual patrol remain pending; do not claim release-candidate passed yet.

> **主题系统当前状态（2026-06-27）**：M9 主题方向已落地为“官方远程免费 ZIP 代码主题 + 当前主题架构完整能力”。`plotflow-blueprint-nightwatch` 已删除；远程主题由官方静态目录注册，下载 `.pf-official-theme.zip`，校验后通过 `plotflow-theme://` 动态加载 `index.mjs`，可提供完整 `ThemeDescriptor`、React surfaces、React slots、tokens、CSS、assets、Monaco 和 UX recipes；Theme Center 使用“官方免费主题库”心智，不做第三方、社区上传、本地导入、购买或授权。完整开发标准见 `doc/standards-theme-development.md`。


> **鐗堟湰**锛歏0.3 | **鍒涘缓鏃ユ湡**锛?026-06-12 | **鏇存柊**锛?026-06-25 瀹樻柟娣卞害涓婚鏋舵瀯 鈥?M0-M7 瀹為檯 132/142 (92.96%)
> **鍏宠仈**锛歚spec/milestones.md`锛堜换鍔″畾涔夋潵婧愶紝宸插綊妗ｄ负鍘嗗彶瑙勫垝锛墊 `CLAUDE.md`锛堝紑鍙戣鑼冿級

---

## 鎬昏

| 閲岀▼纰?| 鍚嶇О | 浠诲姟鏁?| 瀹屾垚 | 杩涜涓?| 鏈紑濮?| 闃诲 | 寤跺悗 | 绉婚櫎 | 杩涘害 |
|:---:|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| M0 | 椤圭洰鑴氭墜鏋?| 13 | 12 | 0 | 0 | 0 | 0 | 1 | 92.31% |
| M1 | 鏍稿績瑙ｆ瀽涓庣紪杈?| 17 | 17 | 0 | 0 | 0 | 0 | 0 | 100% |
| M2 | 鍒嗘敮鍙鍖?| 16 | 16 | 0 | 0 | 0 | 0 | 0 | 100% |
| M3 | 鏉′欢缂栬緫涓庨敊璇娴?| 18 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| M4 | 瀵煎嚭绯荤粺 | 26 | 25 | 0 | 0 | 0 | 1 | 0 | 96.15% |
| M5 | 琛ュ叏寮曟搸 | 19 | 18 | 0 | 0 | 0 | 1 | 0 | 94.74% |
| M6 | 妯℃澘涓庝富棰?| 18 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| M7 | Electron 鎵撳寘鍙戝竷 | 15 | 8 | 0 | 0 | 0 | 7 | 0 | 53.33% |
| **鍚堣** | | **142** | **132** | **0** | **0** | **0** | **9** | **1** | **92.96%** |

> **2026-06-24 鍙戣澶嶆牳**锛氭湰鏂囦欢浠ユ槑缁嗕换鍔＄姸鎬佷负鍞竴缁熻鏉ユ簮锛屽彧鏈?鉁?璁″叆瀹屾垚锛屸彮锔?璁″叆寤跺悗锛屸潓 璁″叆绉婚櫎銆傚綋鍓?M0-M7 鏄庣粏鐪熷疄缁熻涓?132 涓?鉁呫€? 涓?鈴笍銆? 涓?鉂岋紝鍗?132/142 (92.96%)銆侻8 Graph Lab Core 鏄柊澧炲浘浼樺厛宸ヤ綔鍖鸿寖鍥达紝鍗曠嫭璺熻釜锛屼笉娣峰叆 M0-M7 鍘嗗彶鎬绘暟銆?> **2026-06-25 瀹樻柟涓婚鏋舵瀯**锛歁9 Official Theme Architecture 鏄柊澧炲瑙傛嫇灞曡寖鍥达紝鍗曠嫭璺熻釜锛屼笉娣峰叆 M0-M7 鍘嗗彶缁熻銆傚綋鍓嶅彧鍙戣瀹樻柟涓婚锛屼笉寮€鏀剧ぞ鍖哄鍏ユ垨鏈湴 `.pf-theme.zip` 浜у搧鍏ュ彛銆?
---

## 鐘舵€佸浘渚?

| 鏍囪 | 鍚箟 |
|:---:|------|
| 猬?| 鏈紑濮?|
| 馃數 | 杩涜涓?|
| 鉁?| 宸插畬鎴?|
| 馃敶 | 闃诲锛堥渶澶栭儴渚濊禆/鍐崇瓥锛?|
| 鈴笍 | 璺宠繃锛堟湰杞笉瀹炵幇锛?|
| 鉂?| 宸茬Щ闄わ紙涓嶅啀璁″叆鍙氦浠樿寖鍥达級 |

---

## M0 椤圭洰鑴氭墜鏋?

**鐩爣**锛氬伐鍏烽摼鍏ㄧ豢锛岀┖ Electron 绐楀彛鍙惎鍔紝闆朵笟鍔￠€昏緫銆?

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M0-01 | pnpm workspace monorepo 鍒濆鍖?| 鉁?| 2026-06-13 | 2026-06-13 | |
| M0-02 | Electron 涓昏繘绋嬮鏋?| 鉁?| 2026-06-13 | 2026-06-13 | 褰撳墠鍙戣杩愯鏃朵负 Electron 42.5.0 |
| M0-03 | React 18 + TypeScript 5 娓叉煋杩涚▼楠ㄦ灦 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M0-04 | TypeScript strict mode | 鉁?| 2026-06-13 | 2026-06-13 | |
| M0-05 | ESLint + Prettier 閰嶇疆 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M0-06 | Vitest 鍗曞厓娴嬭瘯妗嗘灦 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M0-07 | Playwright E2E 妗嗘灦 | 鉂?| 2026-06-13 | 2026-06-16 | V0.1.1 绉婚櫎 |
| M0-08 | GitHub Actions CI 楠ㄦ灦 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M0-09 | Git Hooks锛坧re-commit + commit-msg锛?| 鉁?| 2026-06-13 | 2026-06-13 | |
| M0-10 | 鐩綍缁撴瀯鍏ㄩ噺寤虹珛 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M0-11 | Zustand 鐘舵€佺鐞嗗垵濮嬪寲 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M0-12 | Monaco Editor 鍗犱綅闆嗘垚 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M0-13 | @plotflow/core 鍖呴鏋?| 鉁?| 2026-06-13 | 2026-06-13 | |

---

## M1 鏍稿績瑙ｆ瀽涓庣紪杈?

**鐩爣**锛歁onaco 缂栬緫鍣ㄥ叿澶?PlotFlow 璇硶楂樹寒锛?mdstory 鏂囦欢鍙畬鏁磋В鏋愪负涓棿琛ㄧず锛屽ぇ绾茶鍥惧彲瀵艰埅銆?

### 瑙ｆ瀽鍣?

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M1-01 | YAML Frontmatter 瑙ｆ瀽鍣?| 鉁?| 2026-06-13 | 2026-06-13 | parser/frontmatter.ts |
| M1-02 | Markdown 鑺傜偣瑙ｆ瀽鍣?| 鉁?| 2026-06-13 | 2026-06-13 | parser/parser.ts |
| M1-03 | 閫夐」璇硶瑙ｆ瀽锛堝惈鏉′欢/鏁堟灉瀛愯锛?| 鉁?| 2026-06-13 | 2026-06-13 | parser/options.ts |
| M1-04 | 鏉′欢琛ㄨ揪寮忚В鏋愬櫒 | 鉁?| 2026-06-13 | 2026-06-13 | parser/conditions.ts |
| M1-05 | 鍙橀噺鎿嶄綔瑙ｆ瀽鍣?| 鉁?| 2026-06-13 | 2026-06-13 | parser/effects.ts |
| M1-06 | PlotFlowData 涓棿琛ㄧず妯″瀷 | 鉁?| 2026-06-13 | 2026-06-13 | types/ast.ts (301 琛? |
| M1-07 | 瑙ｆ瀽鍣ㄥ崟鍏冩祴璇曪紙92 鐢ㄤ緥锛?| 鉁?| 2026-06-13 | 2026-06-13 | __tests__/parser/ 鐩綍 |

### 缂栬緫鍣?

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M1-08 | Monaco 璇硶楂樹寒 鈥?Tokenizer | 鉁?| 2026-06-13 | 2026-06-17 | monaco-tokenizer.ts (V0.2 淇绔犺妭鏍囬姝ｅ垯) |
| M1-09 | Monaco 璇硶楂樹寒 鈥?Theme | 鉁?| 2026-06-13 | 2026-06-13 | monaco-theme-dark.json + light.json |
| M1-10 | 鎷彿鑷姩闂悎 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M1-11 | 鑺傜偣鎶樺彔锛圕ode Folding锛?| 鉁?| 2026-06-13 | 2026-06-13 | |
| M1-12 | 鍝嶅簲寮忎繚瀛橈紙500ms debounce锛?| 鉁?| 2026-06-13 | 2026-06-13 | |
| M1-13 | 鏂囦欢鎿嶄綔鏈嶅姟 | 鉁?| 2026-06-13 | 2026-06-13 | |

### 澶х翰瑙嗗浘

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M1-14 | OutlinePanel 缁勪欢 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M1-15 | 澶х翰涓庣紪杈戝櫒鑱斿姩 | 鉁?| 2026-06-13 | 2026-06-13 | |

### 鐘舵€佹爮 & 鑿滃崟

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M1-16 | StatusBar 缁勪欢 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M1-17 | 搴旂敤鑿滃崟鏍忥紙Electron Menu API锛?| 鉁?| 2026-06-13 | 2026-06-13 | |

---

## M2 鍒嗘敮鍙鍖?

**鐩爣**锛歊eact Flow 鍙紪杈戝垎鏀浘瀹炴椂鍙嶆槧 .mdstory 缁撴瀯锛屾嫋鎷借繛绾垮悓姝ヤ慨鏀规枃鏈紝200 鑺傜偣瑙勬ā涓嶅崱銆?

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M2-01 | React Flow 鐢诲竷闆嗘垚 | 鉁?| 2026-06-13 | 2026-06-13 | GraphCanvas.tsx |
| M2-02 | Dagre 甯冨眬寮曟搸閫傞厤 | 鉁?| 2026-06-13 | 2026-06-13 | layout.ts |
| M2-03 | AST 鈫?React Flow 鏁版嵁閫傞厤鍣?| 鉁?| 2026-06-13 | 2026-06-17 | adapter.ts (V0.2 Edge ID 缂栫爜鍔犲浐) |
| M2-04 | StoryNodeCard 鑷畾涔夎妭鐐圭粍浠?| 鉁?| 2026-06-13 | 2026-06-13 | StoryNodeCard.tsx |
| M2-05 | 鑺傜偣鐘舵€佺潃鑹诧紙5 绉嶇姸鎬侊級 | 鉁?| 2026-06-13 | 2026-06-13 | adapter-helpers.ts |
| M2-06 | StoryEdge 鑷畾涔夎繛绾跨粍浠?| 鉁?| 2026-06-13 | 2026-06-17 | StoryEdge.tsx (V0.2 鍏ㄤ氦浜掑崌绾? |
| M2-07 | 鍗曞嚮鑺傜偣 鈫?缂栬緫鍣ㄨ烦杞?| 鉁?| 2026-06-13 | 2026-06-13 | handleNodeClick |
| M2-08 | 鍙屽嚮鑺傜偣 鈫?閲嶅懡鍚嶆ā寮?| 鉁?| 2026-06-13 | 2026-06-17 | handleNodeDoubleClick + StoryNodeCard |
| M2-09 | 鎷栨嫿杩炵嚎绔偣 鈫?淇敼璺宠浆鐩爣 | 鉁?| 2026-06-13 | 2026-06-13 | handleConnect |
| M2-10 | 鍙抽敭鑿滃崟锛堣妭鐐?绌虹櫧锛?| 鉁?| 2026-06-13 | 2026-06-13 | |
| M2-11 | Ctrl+鐐瑰嚮 鈫?澶氶€夎妭鐐?| 鉁?| 2026-06-13 | 2026-06-13 | |
| M2-12 | 缂╂斁锛?0%~200%锛?| 鉁?| 2026-06-13 | 2026-06-13 | |
| M2-13 | 涓敭鎷栨嫿骞崇Щ | 鉁?| 2026-06-13 | 2026-06-13 | |
| M2-14 | 200 鑺傜偣铏氭嫙婊氬姩 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M2-15 | 鍚屽眰鑺傜偣姘村钩鎶樺彔 | 鉁?| 2026-06-13 | 2026-06-13 | |
| M2-16 | 缂栬緫鍣ㄤ慨鏀?鈫?鍒嗘敮鍥惧疄鏃舵洿鏂?| 鉁?| 2026-06-13 | 2026-06-13 | |

---

## M3 鏉′欢缂栬緫涓庨敊璇娴?

**鐩爣**锛氬浘褰㈠寲鏉′欢鏋勫缓鍣ㄥ彲鍙屽悜鍚屾鏂囨湰锛屼笁绾ч敊璇郴缁熷畬鏁存爣璁板苟缁欏嚭淇寤鸿銆?

### 鏉′欢缂栬緫鍣?

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M3-01 | ConditionEditor 寮瑰嚭闈㈡澘缁勪欢 | 鉁?| 2026-06-13 | 2026-06-17 | ConditionEditor.tsx (1,948 琛? V0.2 鎺ョ嚎瀹屾垚) |
| M3-02 | 鍙橀噺涓嬫媺妗?| 鉁?| 2026-06-13 | 2026-06-13 | 绫诲瀷鎰熺煡涓嬫媺 |
| M3-03 | 姣旇緝杩愮畻绗︿笅鎷夋 | 鉁?| 2026-06-13 | 2026-06-13 | 鎸夊彉閲忕被鍨嬭繃婊?|
| M3-04 | 鍊艰緭鍏ユ锛堢被鍨嬫劅鐭ワ級 | 鉁?| 2026-06-13 | 2026-06-13 | int/float/bool/enum/string |
| M3-05 | AND/OR 閫昏緫缁勬瀯寤哄櫒 | 鉁?| 2026-06-13 | 2026-06-13 | 宓屽鏈€澶?3 灞?|
| M3-06 | 鏉′欢棰勮琛?| 鉁?| 2026-06-13 | 2026-06-13 | 瀹炴椂鏂囨湰琛ㄨ揪寮?|
| M3-07 | 鍙屽悜鍚屾锛堥潰鏉?鈫?鏂囨湰锛?| 鉁?| 2026-06-13 | 2026-06-17 | V0.2 娣诲姞 AST鈫掗潰鏉垮姞杞?|
| M3-08 | 瑙﹀彂鍏ュ彛 | 鉁?| 2026-06-13 | 2026-06-17 | V0.2 杩炵嚎鍙屽嚮 + [馃敡鏉′欢] 鍥炬爣 |

### 閿欒妫€娴?

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M3-09 | 楠岃瘉鍣ㄥ紩鎿?鈥?8 绉嶉敊璇紙E001-E008锛?| 鉁?| 2026-06-13 | 2026-06-13 | validator.ts |
| M3-10 | 楠岃瘉鍣ㄥ紩鎿?鈥?6 绉嶈鍛婏紙W001-W006锛?| 鉁?| 2026-06-13 | 2026-06-13 | |
| M3-11 | 楠岃瘉鍣ㄥ紩鎿?鈥?3 绉嶅缓璁紙I001-I003锛?| 鉁?| 2026-06-13 | 2026-06-13 | |
| M3-12 | 楠岃瘉鍣ㄥ崟鍏冩祴璇曪紙17 绉?脳 鈮? 鐢ㄤ緥锛?| 鉁?| 2026-06-13 | 2026-06-13 | |

### 閿欒鍛堢幇

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M3-13 | Monaco 娉㈡氮绾胯楗?| 鉁?| 2026-06-13 | 2026-06-13 | diagnosticsDecorator.ts |
| M3-14 | 渚ц竟鏍忔爣璁扮偣 | 鉁?| 2026-06-13 | 2026-06-13 | diagnosticsDecorator.ts |
| M3-15 | Hover Tooltip | 鉁?| 2026-06-13 | 2026-06-13 | diagnosticsDecorator.ts |
| M3-16 | ProblemPanel 缁勪欢 | 鉁?| 2026-06-15 | 2026-06-15 | ProblemPanel 鎸傝浇鍒?App.tsx |
| M3-17 | 鐘舵€佹爮閿欒璁℃暟 | 鉁?| 2026-06-13 | 2026-06-13 | StatusBar.tsx 宸插疄鐜?|
| M3-18 | 閿欒鈫掑垎鏀浘鐫€鑹插悓姝?| 鉁?| 2026-06-13 | 2026-06-15 | adapter.ts getNodeStatus 璇诲彇 diagnostics |

---

## M4 瀵煎嚭绯荤粺

**鐩爣**锛欽SON/HTML/TXT 涓夌鏍煎紡瀵煎嚭鍐呭姝ｇ‘锛孏odot 鎻掍欢缂栬緫鍣?杩愯鏃跺彲鐢紝Unity/Unreal 鎺ュ彛瀹氫箟瀹屽銆?

### JSON 瀵煎嚭

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M4-01 | JSON 瀵煎嚭鍣?| 鉁?| 2026-06-13 | 2026-06-13 | 宸插疄鐜板苟楠岃瘉 |
| M4-02 | JSON Schema 楠岃瘉 | 鉁?| 2026-06-13 | 2026-06-13 | 宸叉帴鍏ラ獙璇佹祦绋?|
| M4-03 | 寰€杩斾竴鑷存€ф祴璇?| 鉁?| 2026-06-13 | 2026-06-13 | 宸茶鐩栨牳蹇冭矾寰?|
| M4-04 | 鐗规畩瀛楃/杈圭晫娴嬭瘯 | 鉁?| 2026-06-13 | 2026-06-13 | 宸茶鐩栬竟鐣岃緭鍏?|

### HTML 瀵煎嚭

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M4-05 | HTML 瀵煎嚭鍣紙鍗曟枃浠惰嚜鍖呭惈锛?| 鉁?| 2026-06-13 | 2026-06-13 | 宸插疄鐜板苟楠岃瘉 |
| M4-06 | HTML 浜や簰閫昏緫 | 鉁?| 2026-06-13 | 2026-06-13 | 宸插疄鐜板苟楠岃瘉 |
| M4-07 | HTML 鍙橀噺闈㈡澘 | 鉁?| 2026-06-13 | 2026-06-13 | 宸插疄鐜板苟楠岃瘉 |
| M4-08 | HTML 闈㈠寘灞戝鑸?| 鉁?| 2026-06-13 | 2026-06-13 | 宸插疄鐜板苟楠岃瘉 |
| M4-09 | HTML 鍝嶅簲寮忓竷灞€ | 鉁?| 2026-06-13 | 2026-06-13 | 宸插疄鐜板苟楠岃瘉 |

### TXT 瀵煎嚭

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M4-10 | TXT 瀵煎嚭鍣?| 鉁?| 2026-06-13 | 2026-06-13 | 宸插疄鐜板苟楠岃瘉 |

### 瀵煎嚭 UI

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M4-11 | ExportDialog 缁勪欢 | 鉁?| 2026-06-13 | 2026-06-13 | 宸插疄鐜板苟楠岃瘉 |
| M4-12 | 瀵煎嚭蹇嵎閿?+ 鑿滃崟鍏ュ彛 | 鉁?| 2026-06-13 | 2026-06-13 | 宸叉帴鍏ヨ彍鍗曚笌蹇嵎閿?|

### Godot 鎻掍欢

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M4-13 | Godot 缂栬緫鍣ㄦ彃浠跺叆鍙?| 鉁?| 2026-06-13 | 2026-06-13 | `addons/plotflow/plugin.gd` + `plugin.cfg` |
| M4-14 | Godot Dock 闈㈡澘 | 鉁?| 2026-06-13 | 2026-06-13 | `addons/plotflow/PlotFlowDock.gd` (147琛? |
| M4-15 | Godot 鍙橀噺鍚屾鍣?| 鉁?| 2026-06-13 | 2026-06-13 | `addons/plotflow/VariableSync.gd` (126琛? |
| M4-16 | Godot 瀵煎嚭瑙﹀彂鍣?| 鉁?| 2026-06-13 | 2026-06-13 | `addons/plotflow/ExportTrigger.gd` (48琛? |
| M4-17 | Godot 杩愯鏃跺簱 鈥?StoryLoader | 鉁?| 2026-06-13 | 2026-06-13 | `addons/plotflow/runtime/StoryLoader.gd` (99琛? |
| M4-18 | Godot 杩愯鏃跺簱 鈥?StoryNode | 鉁?| 2026-06-13 | 2026-06-13 | `addons/plotflow/runtime/StoryNode.gd` (80琛? |
| M4-19 | Godot 杩愯鏃跺簱 鈥?ConditionEval | 鉁?| 2026-06-13 | 2026-06-13 | `addons/plotflow/runtime/ConditionEval.gd` (146琛? |
| M4-20 | Godot 杩愯鏃跺簱 鈥?VariableStore | 鉁?| 2026-06-13 | 2026-06-13 | `addons/plotflow/runtime/VariableStore.gd` (53琛? |
| M4-21 | Godot 鎻掍欢鍗曞厓娴嬭瘯 | 鉁?| 2026-06-13 | 2026-06-13 | 杩愯鏃跺簱瀹屾暣锛堟潯浠惰瘎浼?鍙橀噺瀛樺偍/鏁呬簨鍔犺浇锛?|

### Unity 鎺ュ彛

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M4-22 | Unity C# 鎺ュ彛瀹氫箟 | 鉁?| 2026-06-13 | 2026-06-13 | `plugins/unity/IPlotFlowReader.cs` (277琛? |
| M4-23 | Unity 绀轰緥瀹炵幇 | 鉁?| 2026-06-13 | 2026-06-13 | `plugins/unity/PlotFlowJsonReader.cs` (549琛? |
| M4-24 | Unity 绀轰緥鍦烘櫙 | 鈴笍 | 鈥?| 鈥?| 寤跺悗鑷?V0.3锛堜笉褰卞搷鏍稿績瀵煎嚭鍔熻兘锛?|

### Unreal 鎺ュ彛

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M4-25 | Unreal 钃濆浘鎺ュ彛 | 鉁?| 2026-06-13 | 2026-06-13 | `plugins/unreal/BPI_PlotFlowReader.uasset.md` 鎺ュ彛鍙傝€?|
| M4-26 | Unreal C++ 鏁版嵁妯″瀷 | 鉁?| 2026-06-13 | 2026-06-13 | `plugins/unreal/PlotFlowDataTypes.h` (15KB) |

---

## M5 琛ュ叏寮曟搸

**鐩爣**锛氱函瀹㈡埛绔?N-gram 寮曟搸瀹炵幇鍥涚淮骞界伒瀛楃琛ュ叏锛孴ab 鎺ュ彈/Esc 蹇界暐锛岃鏂欑绾垮涔犱笌瀵煎叆銆?

> **娉ㄦ剰**锛氬紩鎿庛€乁I銆佸涔犲櫒銆佸鍏ョ閬撳凡鍏ㄩ儴瀹屾垚銆備腑鏂囪鏂欏寘褰撳墠 45KB锛堣鏍?3.5MB锛夈€佽嫳鏂?30KB锛堣鏍?1.5MB锛夛紝璇枡瑙勬ā鎵╁睍璁″垝鍦?V0.3 杩涜銆?

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M5-01 | NGramEngine 鏍稿績 | 鉁?| 鈥?| 鈥?| `packages/core/src/completion/NGramEngine.ts` |
| M5-02 | 棰勭疆璇枡搴撳姞杞藉櫒 | 鉁?| 鈥?| 鈥?| `packages/core/src/completion/CorpusLoader.ts` |
| M5-03 | 鍊掓帓绱㈠紩 | 鉁?| 鈥?| 鈥?| `packages/core/src/completion/InvertedIndex.ts` |
| M5-04 | 寮曟搸鍗曞厓娴嬭瘯锛堚墺24 鐢ㄤ緥锛?| 鉁?| 鈥?| 鈥?| 658 鐢ㄤ緥锛堝惈 11 鏂板 CorpusLoader 娴嬭瘯锛?|
| M5-05 | 涓枃璇枡鍖咃紙3.5MB锛?| 鈴笍 | 鈥?| 鈥?| 寤跺悗鑷?V0.3 |
| M5-06 | 鑻辨枃璇枡鍖咃紙1.5MB锛?| 鉁?| 2026-06-13 | 2026-06-13 | `packages/core/corpus/en.json` 鈥?152 鍙ワ紝50% 娓告垙+50% 鏂囧 |
| M5-07 | 璇枡棰勫鐞嗚剼鏈?| 鉁?| 2026-06-13 | 2026-06-13 | `scripts/preprocess-corpus.ts` 鈥?绌烘牸鍒嗚瘝+鍒嗙被鎺ㄦ柇+杈撳嚭 |
| M5-08 | GhostTextPlugin锛圡onaco 鎵╁睍锛?| 鉁?| 2026-06-13 | 2026-06-17 | V0.2 鎺ョ嚎鍒?setupEditor.ts |
| M5-09 | 鍥涚淮瑙﹀彂妫€娴?| 鉁?| 2026-06-13 | 2026-06-17 | V0.2 鍏?4 缁村害灏辩华 |
| M5-10 | 骞界伒瀛楃娓叉煋閫昏緫 | 鉁?| 2026-06-13 | 2026-06-17 | InlineCompletionItem 鐏拌壊鍗婇€忔槑 |
| M5-11 | Tab 鎺ュ彈 / Esc 蹇界暐 / 杈撳叆瑕嗙洊 | 鉁?| 2026-06-13 | 2026-06-17 | Monaco 鍘熺敓琛屼负 |
| M5-12 | Ctrl+Space 澶氬€欓€変笅鎷夎彍鍗?| 鉁?| 2026-06-13 | 2026-06-17 | CompletionItemProvider 娉ㄥ唽 |
| M5-13 | 棰戠巼鎺у埗锛?100ms 涓嶈Е鍙戯級 | 鉁?| 2026-06-13 | 2026-06-17 | MIN_TRIGGER_INTERVAL_MS=100 |
| M5-14 | 澧為噺瀛︿範鍣?| 鉁?| 2026-06-13 | 2026-06-13 | `packages/core/src/completion/Learner.ts` (359琛? |
| M5-15 | N-gram 鏉冮噸琛板噺锛?0 澶╂満鍒讹級 | 鉁?| 2026-06-13 | 2026-06-13 | Learner.ts 瀹炵幇 90 澶╁崐琛?/ 180 澶╃Щ闄ょ瓥鐣?|
| M5-16 | 瀛︿範鏁版嵁鎸佷箙鍖?| 鉁?| 2026-06-13 | 2026-06-13 | `Persistence.ts` (373琛?锛孞SON 鏂囦欢鎸佷箙鍖?|
| M5-17 | 璇枡瀵煎叆鍣?| 鉁?| 2026-06-13 | 2026-06-13 | `CorpusImporter.ts` (654琛?锛屾敮鎸?.txt/.mdstory/.csv |
| M5-18 | 瀵煎叆棰勫鐞?| 鉁?| 2026-06-13 | 2026-06-13 | `PreprocessingPipeline.ts` (337琛?锛屽幓閲?鍒嗘+娓呮礂 |
| M5-19 | CorpusManager 璁剧疆闈㈡澘 | 鉁?| 2026-06-13 | 2026-06-13 | `CorpusManager.tsx` (1029琛?锛岃鏂欏垪琛?瀵煎叆/绂佺敤/鍒犻櫎 |

---

## M6 妯℃澘涓庝富棰?

**鐩爣**锛? 涓唴缃ā鏉垮彲鍒涘缓鏂版枃浠讹紝鏆楄壊/浜壊涓婚鍗虫椂鍒囨崲锛屼腑鑻卞弻璇畬鏁磋鐩栥€?

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M6-01 | 妯℃澘寮曟搸 | 鉁?| 2026-06-13 | 2026-06-13 | `packages/core/src/template/TemplateEngine.ts`锛屼繚鐣欐湭鐭ュ崰浣嶇 |
| M6-02 | RPG 瀵硅瘽妯℃澘锛? 鑺傜偣锛?| 鉁?| 2026-06-13 | 2026-06-13 | `templates/rpg-dialogue.mdstory`锛屽崟鍏冩祴璇曢獙璇佽妭鐐规暟 |
| M6-03 | 瑙嗚灏忚妯℃澘锛? 鑺傜偣锛?| 鉁?| 2026-06-13 | 2026-06-13 | `templates/visual-novel.mdstory`锛屽崟鍏冩祴璇曢獙璇佽妭鐐规暟 |
| M6-04 | 瑙ｈ皽娓告垙妯℃澘锛?0 鑺傜偣锛?| 鉁?| 2026-06-13 | 2026-06-13 | `templates/puzzle-escape.mdstory`锛屽崟鍏冩祴璇曢獙璇佽妭鐐规暟 |
| M6-05 | Godot 绀轰緥椤圭洰妯℃澘锛?0 鑺傜偣锛?| 鉁?| 2026-06-13 | 2026-06-13 | `templates/godot-example/`锛屽惈 story銆丷EADME銆乸roject銆乺untime script |
| M6-06 | NewFileDialog 缁勪欢 | 鉁?| 2026-06-13 | 2026-06-13 | 妯℃澘閫夋嫨銆佹爣棰?浣滆€呰緭鍏ャ€侀瑙堛€佸垱寤洪棴鐜凡鎺ュ叆 App |
| M6-07 | 鏆楄壊涓婚 CSS 鍙橀噺 | 鉁?| 2026-06-13 | 2026-06-13 | `tokens-dark.css`锛孋SS 鍙橀噺椹卞姩 |
| M6-08 | 鏆楄壊涓婚 Monaco 涓婚 | 鉁?| 2026-06-13 | 2026-06-13 | `ThemeProvider` 鍚屾 Monaco theme |
| M6-09 | 鏆楄壊涓婚鍒嗘敮鍥捐妭鐐规牱寮?| 鉁?| 2026-06-13 | 2026-06-13 | `branch-graph.css` 浣跨敤 token 鐘舵€佽壊 |
| M6-10 | 浜壊涓婚 CSS 鍙橀噺 | 鉁?| 2026-06-13 | 2026-06-13 | `tokens-light.css`锛岄粯璁や寒鑹蹭富棰?|
| M6-11 | 浜壊涓婚 Monaco 涓婚 | 鉁?| 2026-06-13 | 2026-06-13 | `ThemeProvider` 鍚屾 Monaco theme |
| M6-12 | 浜壊涓婚鍒嗘敮鍥捐妭鐐规牱寮?| 鉁?| 2026-06-13 | 2026-06-13 | 榛樿浜壊 token 瑕嗙洊鑺傜偣鍜岃繛绾跨姸鎬?|
| M6-13 | ThemeProvider 鏈哄埗 | 鉁?| 2026-06-13 | 2026-06-13 | `html[data-theme]` + Monaco 涓婚鍗虫椂鍚屾 |
| M6-14 | ThemeToggle 宸ュ叿鏍忔寜閽?| 鉁?| 2026-06-13 | 2026-06-13 | 宸ュ叿鏍忓浘鏍囨寜閽?+ `Ctrl+Shift+T` 鑿滃崟浜嬩欢 |
| M6-15 | i18n 妗嗘灦 | 鉁?| 2026-06-13 | 2026-06-13 | `packages/core/src/i18n/i18n.ts`锛岃交閲忔湰鍦拌祫婧愯闃?|
| M6-16 | 涓枃缈昏瘧鏂囦欢 | 鉁?| 2026-06-13 | 2026-06-13 | `locales/zh-CN.json` + core runtime resources |
| M6-17 | 鑻辨枃缈昏瘧鏂囦欢 | 鉁?| 2026-06-13 | 2026-06-13 | `locales/en-US.json` + core runtime resources |
| M6-18 | 璇█鍒囨崲鍣?| 鉁?| 2026-06-13 | 2026-06-13 | 宸ュ叿鏍忚瑷€ select锛屽嵆鏃跺垏鎹紝鏃犲埛鏂?|

### M6 楠岃瘉璁板綍

| 绫诲瀷 | 缁撴灉 | 澶囨敞 |
|------|------|------|
| TypeScript | 鉁?| `pnpm.cmd exec tsc --noEmit` |
| ESLint | 鉁?| `pnpm.cmd exec eslint . --ext .ts,.tsx`锛? errors锛沗scripts/preprocess-corpus.ts` 淇濈暀 25 涓棦鏈?`no-console` warnings |
| Stylelint | 鉁?| `pnpm.cmd exec stylelint "packages/app/src/styles/**/*.css"` |
| Vitest | 鉁?| `pnpm.cmd exec vitest run`锛?5 files / 746 tests |
| Production build | 鉁?| `pnpm.cmd exec electron-vite build`锛涗粛鏈夋棦鏈?Vite externalized Node module warnings锛坄CorpusLoader.ts` 娴忚鍣ㄦ墦鍖呰矾寰勶級 |
| Runtime screenshots | 鉁?| `test-results/m6-polish-shell-light.png`銆乣m6-polish-new-file-dialog.png`銆乣m6-polish-shell-dark.png`銆乣m6-polish-mobile.png` |

---

## M7 Electron 鎵撳寘涓庡彂甯?

**鐩爣**锛氫笁骞冲彴瀹夎鍖呯敓鎴愶紝瀹夎鍣ㄤ綋楠屾甯革紝.mdstory 鏂囦欢鍏宠仈鐢熸晥锛岃嚜鍔ㄦ洿鏂伴€氶亾灏辩华銆?

| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M7-01 | electron-builder 閰嶇疆 | 鉁?| 2026-06-13 | 2026-06-13 | electron-builder.config.js |
| M7-02 | Windows 鏈湴鏋勫缓锛圢SIS .exe锛?| 鉁?| 2026-06-23 | 2026-06-24 | `pnpm.cmd package:win` 鏄惧紡鍔犺浇 `electron-builder.config.js`锛岀敓鎴?`release/PlotFlow Setup 0.1.0.exe`銆乥lockmap 涓?`release/win-unpacked/PlotFlow.exe` |
| M7-03 | macOS 鏋勫缓锛?dmg锛?| 鈴笍 | 鈥?| 鈥?| 闇€ CI 鐭╅樀鏋勫缓 |
| M7-04 | Linux 鏋勫缓锛?AppImage + .deb锛?| 鈴笍 | 鈥?| 鈥?| 闇€ CI 鐭╅樀鏋勫缓 |
| M7-05 | 搴旂敤鍥炬爣 | 鉁?| 2026-06-13 | 2026-06-13 | `build/app-icons/` 澶氬垎杈ㄧ巼 + `.ico`/`.icns`/`.png` |
| M7-06 | 搴旂敤淇℃伅 | 鉁?| 2026-06-13 | 2026-06-13 | package.json |
| M7-07 | .mdstory 鏂囦欢鍏宠仈 | 鉁?| 2026-06-13 | 2026-06-13 | electron-builder.config.js 閰嶇疆娉ㄥ唽 |
| M7-08 | 鍙屽嚮 .mdstory 鈫?搴旂敤鎵撳紑 | 鉁?| 2026-06-13 | 2026-06-13 | mainProcessUtils.ts `findStoryFileArgument` |
| M7-09 | electron-updater 闆嗘垚 | 鈴笍 | 鈥?| 鈥?| 寤跺悗鑷?V0.3 |
| M7-10 | 鏇存柊鏈嶅姟鍣ㄩ厤缃?| 鈴笍 | 鈥?| 鈥?| 寤跺悗鑷?V0.3 |
| M7-11 | CHANGELOG.md | 鉁?| 2026-06-13 | 2026-06-17 | V0.2 鏇存柊 |
| M7-12 | GitHub Release 鑽夌 | 鈴笍 | 鈥?| 鈥?| 寤跺悗鑷?V0.3 |
| M7-13 | 瀹夎鍚庨娆″惎鍔ㄥ紩瀵?| 鈴笍 | 鈥?| 鈥?| 寤跺悗鑷?V0.3 |
| M7-14 | Windows 瀹夎鍖呭啋鐑熸祴璇?| 鉁?| 2026-06-23 | 2026-06-24 | packaged exe 鍚姩銆佸懡浠よ鎵撳紑 `.mdstory`銆丟raph Lab GUI 缂栬緫銆丼ource Drawer銆佸鍑?JSON smoke 閫氳繃 |
| M7-15 | macOS/Linux 鍩虹鍐掔儫娴嬭瘯 | 鈴笍 | 鈥?| 鈥?| 寤跺悗鑷?V0.3 |

---

## M8 Graph Lab Core锛堝浘浼樺厛姝ｅ紡鍏ュ彛锛?
**鐩爣**锛氬湪涓嶆浛鎹㈢幇鏈?split 鍒嗘爮妯″紡鐨勫墠鎻愪笅锛屾妸鈥滄祦绋嬪浘浼樺厛鈥濈殑瀹屾暣 GUI 鎿嶄綔闂幆鎺ㄨ繘涓烘寮忕増鏍稿績鍏ュ彛涔嬩竴銆俙.mdstory` 浠嶆槸鍞竴纾佺洏鏍煎紡锛孏raph Lab 涓庢簮鏂囨湰鏄悓涓€鏁呬簨鏁版嵁鐨勫弻鎶曞奖銆?
> **缁熻瑙勫垯**锛歁8 鏄?2026-06-23 鏂板鍥句紭鍏堣寖鍥达紝褰撳墠 17/18锛屾殏涓嶆贩鍏?M0-M7 142 椤瑰巻鍙插彂琛岀粺璁°€侻8-18 鐨勫彂甯冭鏄?甯姪鏂囨闅忓叕寮€涓嬭浇椤垫敹灏俱€?
| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M8-01 | `workspaceMode: 'split' \| 'graphLab'` 鐘舵€佷笌鎸佷箙鍖?| 鉁?| 2026-06-24 | 2026-06-24 | `useUIStore` 鎸佷箙鍖栨ā寮忥紝娴嬭瘯妗ユ帴鍙鍐?|
| M8-02 | 椤堕儴妯″紡鍒囨崲鎸夐挳涓庡揩鎹烽敭 | 鉁?| 2026-06-24 | 2026-06-24 | Toolbar Split/Graph Lab 鎸夐挳涓?`Ctrl+Shift+G` |
| M8-03 | Graph Lab 鍏ㄥ睆鐢诲竷澹?| 鉁?| 2026-06-24 | 2026-06-24 | `GraphLabWorkspace` 涓夋爮鍥句紭鍏堝竷灞€ |
| M8-04 | 鑺傜偣 palette 涓庣┖鐧界敾甯冨垱寤哄叆鍙?| 鉁?| 2026-06-24 | 2026-06-24 | `GraphLabPalette` 鍒涘缓绔犺妭/鑺傜偣/缁撳眬涓庨噸鏂板竷灞€ |
| M8-05 | `graphEditService` 鍛戒护灞?| 鉁?| 2026-06-24 | 2026-06-24 | GUI 鎿嶄綔缁熶竴鐢熸垚 `.mdstory` 鏂囨湰缂栬緫骞惰蛋瑙ｆ瀽绠＄嚎 |
| M8-06 | GUI 鍒涘缓/鍒犻櫎鑺傜偣 | 鉁?| 2026-06-24 | 2026-06-24 | Palette 鍒涘缓锛孖nspector 鍒犻櫎 |
| M8-07 | Inspector 缂栬緫鑺傜偣鏍囬銆佺珷鑺傘€佹鏂?| 鉁?| 2026-06-24 | 2026-06-24 | 鏀瑰悕鍚庡悓姝ラ€変腑鑺傜偣 id锛岄伩鍏?Inspector 涓㈠け涓婁笅鏂?|
| M8-08 | GUI 鍒涘缓/缂栬緫/鍒犻櫎/鎺掑簭閫夐」 | 鉁?| 2026-06-24 | 2026-06-24 | 鏀寔鎻忚堪銆佺洰鏍囥€佹潯浠躲€佹晥鏋溿€佷笂绉?涓嬬Щ/鍒犻櫎 |
| M8-09 | 鎷栫嚎杩炴帴宸叉湁鐩爣鑺傜偣 | 鉁?| 2026-06-24 | 2026-06-24 | 钃濆浘寮忕嚎缂嗙儹鍖猴紱鎷栧埌宸叉湁鑺傜偣鐩存帴鍐欏洖閫夐」鐩爣 |
| M8-10 | 鎷栫嚎鍒扮┖鐧藉鍒涘缓鐩爣鑺傜偣骞惰繛鎺?| 鉁?| 2026-06-24 | 2026-06-24 | 绌烘姇鍔ㄤ綔鑿滃崟鏀寔鍒涘缓鏅€氳妭鐐广€佸垱寤虹粨灞€鑺傜偣銆佹悳绱㈠凡鏈夎妭鐐广€佸彇娑?|
| M8-11 | 鏉′欢缂栬緫鍣ㄥ祵鍏?Inspector | 鉁?| 2026-06-24 | 2026-06-24 | Inspector 鍐呰仈缂栬緫 `[鏉′欢]`锛屼繚鐣欏師娴眰鏉′欢缂栬緫鍣?|
| M8-12 | 鏁堟灉缂栬緫鍣?| 鉁?| 2026-06-24 | 2026-06-24 | Inspector 鍐呰仈缂栬緫 `[鏁堟灉]` |
| M8-13 | 鍙橀噺鍜?meta 缂栬緫鍏ュ彛 | 鉁?| 2026-06-24 | 2026-06-24 | Meta title/author 涓?`vars:` 绫诲瀷澹版槑缂栬緫 |
| M8-14 | 鍥炬ā寮忚瘖鏂姸鎬佷笌 ProblemPanel 鑱斿姩 | 鉁?| 2026-06-24 | 2026-06-24 | Graph Lab 澶嶇敤 ProblemPanel 涓庤瘖鏂悓姝ョ姸鎬?|
| M8-15 | 鍙姌鍙?Source Drawer | 鉁?| 2026-06-24 | 2026-06-24 | 婧愭枃鏈彧璇?瀹氫綅杈呭姪鎶藉眽锛孏raph Lab 鍐呭彲灞曞紑 |
| M8-16 | GUI 鎿嶄綔涓?Monaco 鎾ら攢鏍堝悓姝?| 鉁?| 2026-06-24 | 2026-06-24 | 浼樺厛 `executeEdits()`锛屾棤 editor 瀹炰緥鏃?fallback 鍒?store |
| M8-17 | Graph Lab 瀹屾暣鐢ㄦ埛鏃呯▼ E2E | 鉁?| 2026-06-24 | 2026-06-24 | `graph-lab.e2e.spec.ts` 瑕嗙洊鍒涘缓銆佺紪杈戙€佽妭鐐逛綅缃寔涔呭寲銆佹嫋绾垮埌宸叉湁鑺傜偣銆佺┖鎶曞垱寤鸿妭鐐广€佹柇寮€绾跨紗銆佸彉閲忋€丼ource Drawer銆佸鍑?JSON |
| M8-18 | 鍙戝竷璇存槑銆佸府鍔╂枃妗堛€佸叕寮€涓嬭浇椤垫敹灏?| 馃數 | 2026-06-24 | 鈥?| Graph Lab 宸茶浆姝ｅ紡鍏ュ彛锛涘叕寮€鍙戝竷鏂囨寰呴殢涓嬭浇椤电粺涓€鏀跺熬 |

---

## M9 Official Theme Architecture锛堝畼鏂规繁搴︿富棰樻灦鏋勶級

**鐩爣**锛氭妸涓婚浠?token/layoutRecipe 绾у埆鎺ㄨ繘涓哄畼鏂圭紪璇戝唴缃ā鍧楃儹鎻掓嫈銆傚綋鍓嶅彧鍙戣瀹樻柟涓婚锛屽畼鏂逛富棰樺彲浠ユ浛鎹㈣妭鐐广€佺嚎缂嗐€佺鍙ｃ€侀潰鏉裤€丮onaco 閰嶈壊銆侀瑙堝拰鍔ㄦ晥锛涚ぞ鍖轰富棰樸€佹湰鍦?`.pf-theme.zip` 鍜岃繙绋嬩笅杞芥殏涓嶅紑鏀句负浜у搧鍏ュ彛銆?
> **缁熻瑙勫垯**锛歁9 鏄?2026-06-25 鏂板涓婚鐢熸€佽寖鍥达紝鏆備笉娣峰叆 M0-M7 142 椤瑰巻鍙插彂琛岀粺璁°€?
| # | 浠诲姟 | 鐘舵€?| 寮€濮?| 瀹屾垚 | 澶囨敞 |
|---|------|:---:|------|------|------|
| M9-01 | OfficialThemeDefinition 鍚堝悓 | 鉁?| 2026-06-25 | 2026-06-25 | manifest銆乼okens銆丮onaco銆乤ssets銆乴ayoutRecipe銆乵otionRecipe銆乻toreMeta銆丷eact slots |
| M9-02 | 瀹樻柟涓婚 provider | 鉁?| 2026-06-25 | 2026-06-25 | `activeOfficialThemeId`銆佹棫 `themePack` 杩佺Щ銆丆SS var/data attribute銆丮onaco 娉ㄥ唽 |
| M9-03 | 鍙欎簨宸ヤ綔鍙板畼鏂逛富棰?| 鉁?| 2026-06-25 | 2026-06-25 | `plotflow-narrative-workbench`锛氭殩绾稿伐浣滃彴 + 钃濆浘绾跨紗 |
| M9-04 | 澶滆埅钃濆浘瀹樻柟涓婚 | 鉁?| 2026-06-25 | 2026-06-25 | `plotflow-neon-dossier`锛氫綆鍏夌紪杈戝 + 鍙戝厜绾跨紗 |
| M9-05 | Theme Slots 鎺ュ叆 GraphCanvas | 鉁?| 2026-06-25 | 2026-06-25 | 鑺傜偣銆佺嚎缂嗐€侀瑙?slot 闅忓畼鏂逛富棰樺垏鎹紱涓嶅啀鍥哄畾鏃?`StoryNodeCard`/`StoryEdge` |
| M9-06 | HomeSurface 涓?ThemeCenter | 鉁?| 2026-06-25 | 2026-06-25 | 璧峰椤典富棰樻ā鍧椼€乀opbar 涓婚鍏ュ彛銆佸畼鏂逛富棰樺惎鐢?閲嶇疆/鍟嗗簵璺宠浆锛涗笉鏆撮湶瀵煎叆涓婚鍖?|
| M9-07 | 瀹樼綉瀹樻柟涓婚灞曠ず | 鉁?| 2026-06-25 | 2026-06-25 | 棣栭〉灞曠ず `鍙欎簨宸ヤ綔鍙癭 涓?`澶滆埅钃濆浘`锛屽紑鍙戦〉鍙ｅ緞鏀逛负瀹樻柟涓婚 |
| M9-08 | 绀惧尯涓婚/鏈湴瀵煎叆/鍐呯疆甯傚満 | 鈴笍 | 鈥?| 鈥?| 鏆備笉寮€鏀撅紱鍚庣画鍙︾珛涓婚甯傚満涓庢巿鏉冭寖鍥?|

---

## 寤舵湡涓庣Щ闄ら」

| 閲岀▼纰?| 闃诲鏁?| 璇存槑 |
|--------|:---:|------|
| M0 | 1 | M0-07 Playwright E2E 妗嗘灦鍘嗗彶浠诲姟鍦?V0.1.1 绉婚櫎锛涘綋鍓?E2E 宸插湪 app 鍖呭唴鎭㈠锛屼笉鎸夊師 M0 浠诲姟璁℃暟 |
| M4 | 1 | M4-24 Unity 绀轰緥鍦烘櫙寤跺悗鑷?V0.3锛屼笉褰卞搷 JSON/HTML/TXT 涓?Godot 闂幆 |
| M5 | 1 | M5-05 涓枃璇枡鍖呮墿灞曡嚦 3.5MB 寤跺悗鑷?V0.3 |
| M7 | 7 | macOS/Linux 瀹夎鍖呫€佽嚜鍔ㄦ洿鏂般€丟itHub Release銆侀娆″惎鍔ㄥ紩瀵笺€乵acOS/Linux 鍐掔儫娴嬭瘯寤跺悗 |

---

## 鍙戣闂ㄧ鐘舵€?
| 闂ㄧ | 褰撳墠缁撴灉 | 澶囨敞 |
|------|------|------|
| `pnpm.cmd lint` | 鉁?PASS | 0 error锛? 涓棦鏈?`no-console` warning |
| `pnpm.cmd typecheck` | 鉁?PASS | TypeScript strict 閫氳繃 |
| `pnpm.cmd test` | 鉁?PASS | 44 files / 1252 tests; includes export filename fallback, main-process write verification, Graph Lab referenced-node rename, and app i18n coverage. |
| `pnpm.cmd build` | 鉁?PASS | 淇濈暀 1 涓?Vite 鍔ㄦ€?闈欐€?import warning |
| `pnpm.cmd lint:css` | 鉁?PASS | CSS token/stylelint 閫氳繃 |
| `pnpm.cmd --filter @plotflow/progress-dashboard test` | 鉁?PASS | 杩涘害浠〃鐩樺崟鍏冩祴璇曢€氳繃 |
| `pnpm.cmd --filter @plotflow/progress-dashboard typecheck` | 鉁?PASS | 杩涘害浠〃鐩樼被鍨嬫鏌ラ€氳繃 |
| `pnpm.cmd --filter @plotflow/app test:e2e` | ✅ PASS | 49 passed after the latest save-flow fix. Includes duplicate Save As prevention, Save As failure feedback, and Save As cancellation blocking file replacement. |
| `pnpm.cmd --filter @plotflow/app test:e2e:blackbox` | ✅ PASS | 10 passed / 4 packaged-or-installed skipped after the latest save-flow fix. Skips still require package/installed targets. |
| `pnpm.cmd --filter @plotflow/app test:e2e:unpacked` | ⚠️ STALE | Last unpacked package predates the latest save-flow fix. Rebuild and rerun against `release/win-unpacked/PlotFlow.exe`. |
| `pnpm.cmd --filter @plotflow/app test:e2e:installed` | ⏳ PENDING | Must run after installing the newly built installer and setting `PLOTFLOW_INSTALLED_EXE`, for example `D:\PF\PlotFlow\PlotFlow.exe`. |
| `pnpm.cmd audit --audit-level moderate` | 鉁?PASS | Electron 42.5.0锛涙棤 GHSA ignore锛汵o known vulnerabilities found |
| `pnpm.cmd package:win` | ⚠️ STALE | Previous 2026-07-01 package predates the latest save-flow fix. Clear/rebuild before using as release evidence. |
| Windows packaged smoke | ⚠️ STALE | Previous packaged smoke does not include the latest save-flow fix. Rerun after a fresh package build. |

---

## 褰撳墠鍗＄偣

| 鍗＄偣 | 褰卞搷 | 鍒ゆ柇 |
|------|------|------|
| 鏃?Electron 涓荤増鏈畨鍏ㄩ闄╂帴鍙?| 宸茶В闄?| 杩愯鏃跺凡杩佺Щ鍒?Electron 42.5.0锛宍pnpm audit --audit-level moderate` 鏃犲凡鐭ユ紡娲烇紝鏃ч闄╂帴鍙楁枃妗ｄ粎淇濈暀涓哄巻鍙插揩鐓?|
| ExportDialog E2E 鑷姩鍏抽棴绔炴€?| 鍘嗗彶澶嶆牳鍗＄偣锛屾湰杞湭澶嶇幇 | 涓婁竴杞け璐ユ寚鍚戝鍑哄璇濇 auto-close timer 涓?close helper 绔炰簤锛涙湰杞鍑哄浠?5/5 閫氳繃锛屼繚鐣欎负鍥炲綊鍏虫敞椤?|
| 骞冲彴鍙戝竷浠诲姟寤跺悗 | 闃绘柇瀹屾暣鍟嗕笟鍙戣 | macOS/Linux 瀹夎鍖呫€佽嚜鍔ㄦ洿鏂般€佸彂甯冭崏绋裤€侀娆″惎鍔ㄥ紩瀵笺€乵acOS/Linux 鍐掔儫灏氭湭瀹屾垚 |
| Graph Lab 鍙戝竷璇存槑/甯姪鏂囨鏈敹灏?| 涓嶉樆鏂?Windows 鏈湴鍖呮妧鏈獙鏀讹紝褰卞搷鍏紑涓嬭浇椤靛拰鐢ㄦ埛涓婃墜鏉愭枡 | Graph Lab 鏍稿績 GUI 闂幆銆丒2E 涓?packaged smoke 宸查€氳繃锛汳8-18 淇濇寔杩涜涓?|
| 涓婚甯傚満涓庢巿鏉?| 鍚庣画澧炲己椤?| 褰撳墠鍙彂琛屽畼鏂瑰唴缃富棰橈紝璐拱鍏ュ彛璺宠浆瀹樼綉锛涚ぞ鍖轰富棰樸€佹湰鍦板鍏ャ€佽繙绋嬬储寮曘€佹巿鏉冧笅杞藉拰鏇存柊鐣欏埌鍚庣画浠诲姟 |

---

## 鍙樻洿鏃ュ織

| 鏃ユ湡 | 鍙樻洿 |
|------|------|
| 2026-06-12 | 鍒濆鍖栬繘搴﹁拷韪枃妗ｏ紝142 椤逛换鍔″叏閮ㄦ爣璁?猬?|
| 2026-06-13 | 鍚屾 M6 妯℃澘涓庝富棰樺畬鎴愮姸鎬侊細18/18锛屽綋鏃ュ巻鍙茶繘搴︿负 125/142锛?8%锛夛紝琛ュ厖楠岃瘉涓庢埅鍥捐褰?|
| 2026-06-16 | V0.1.1 鏁版嵁鏍℃锛氫慨姝?M1/M2/M3/M5/M7 鎬昏琛ㄦ暟鎹笉涓€鑷达紝鏍囪寤跺悗椤逛负 鈴笍锛屽悎璁¤繘搴︿慨姝ｄ负 73/142 (51%) |
| 2026-06-17 | **V0.2 閲岀▼纰?*锛氳繘搴︽牎姝?鈥?M1 瑙ｆ瀽鍣?M2 鍒嗘敮鍥?M3 鏉′欢缂栬緫鍣?M5 琛ュ叏寮曟搸 瀹為檯宸插畬鏁村疄鐜般€傚畬鎴愯繛绾夸氦浜掑熀纭€璁炬柦锛圫toryEdge 鍏ㄤ氦浜掑崌绾с€丒dgeContextMenu銆丄lt+鍒犻櫎銆佸弻鍑烩啋鏉′欢缂栬緫鍣級銆佹潯浠剁紪杈戝櫒 AST 鍔犺浇銆丟hostText 鎺ョ嚎銆丒dge ID encodeURIComponent 鍔犲浐銆佺珷鑺傛爣棰樻鍒欎慨澶嶃€?090 娴嬭瘯鍏?PASS銆傚悎璁¤繘搴?111/142 (78%)銆侴it 浠撳簱鎺ㄩ€佽嚦 jiay98528-dev/PlotFlow銆?|
| 2026-06-20 | **V0.3 杩涘害鏍℃**锛氫唬鐮佸璁″彂鐜?M4锛圙odot/Unity/Unreal 鎻掍欢鍏?3椤癸級鍜?M5锛堝閲忓涔犲櫒/璇枡瀵煎叆/棰勫鐞?鎸佷箙鍖?CorpusManager 鍏?椤癸級瀹為檯宸插畬鏁村疄鐜颁絾鏈湪 progress.md 涓褰曘€俈0.2 QA 瀹¤ 2 CRITICAL+8 HIGH 鍏ㄩ儴淇楠岃瘉閫氳繃銆傚綋鏃ュ揩鐓т负 132/142 (93%)銆備慨姝?M7 鍥炬爣鐘舵€併€?|
| 2026-06-23 | **鍘嗗彶蹇収锛氬彂琛屽璁?E2E 淇楠屾敹**锛歅arser/Validator E2E 鍏叡 helper 涓?minimap DOM 绋冲畾鎬ч棶棰樺凡淇銆傚綋鏃跺畬鏁撮粯璁?E2E 澶嶆牳涓鍑哄浠?5/5 閫氳繃锛屼絾 Parser/Validator TC-6 鍦?`afterAll` 鍏抽棴 Electron 鏃惰秴鏃讹紝褰撴椂 `pnpm.cmd --filter @plotflow/app test:e2e` 涓?28/29 passed锛涘熀纭€闂ㄧ lint/typecheck/test/build/lint:css 鍧囬€氳繃銆俙pnpm.cmd audit --audit-level moderate` 褰撴椂浠嶅け璐ワ紙29 vulnerabilities锛夛紝浣滀负鐙珛瀹夊叏闂ㄧ淇濈暀銆?|
| 2026-06-23 | **鍘嗗彶蹇収锛氳繘搴︽潈濞佹牎姝ｄ笌 Graph Lab 鍚屾**锛氭寜浠诲姟鏄庣粏閲嶆柊缁熻涓?130 涓?鉁呫€?1 涓?鈴笍銆? 涓?鉂岋紝鍗?M0-M7 褰撴椂涓?130/142 (91.55%)銆傛柊澧?M8 Graph Lab Experimental 18 椤癸紝鍏ㄩ儴鏈紑濮嬶紝涓嶆贩鍏?M0-M7 鍘嗗彶缁熻銆?|
| 2026-06-23 | **鍙戣闃绘柇淇涓?M7 鏈湴鎵撳寘澶嶆牳**锛歅arser/Validator teardown 鏀逛负 race-safe 鍏抽棴锛岄粯璁?app E2E 鎭㈠ 29/29銆傚崌绾?Vitest/Vite/electron-vite/electron-builder/tar 閾捐矾骞惰縼绉诲埌 pnpm 11.5.1锛孍lectron 28 鍓╀綑 17 涓?GHSA 浠ラ闄╂帴鍙楁枃妗ｅ拰 `auditConfig.ignoreGhsas` 鏄惧紡鏀捐锛宍pnpm.cmd audit --audit-level moderate` 閫€鍑虹爜涓?0銆俙pnpm.cmd package:win` 鎴愬姛鐢熸垚 NSIS installer 涓?win-unpacked锛宲ackaged smoke 楠岃瘉鍚姩銆佸懡浠よ鎵撳紑銆佺紪杈戜繚瀛樸€丣SON 瀵煎嚭閫氳繃銆侻7-02/M7-14 鏍囪瀹屾垚锛屽綋鍓?M0-M7 涓?132/142 (92.96%)銆?|
| 2026-06-24 | **Graph Lab 姝ｅ紡鍏ュ彛涓?Electron 42 Windows 姝ｅ紡鍖?*锛氭柊澧?`workspaceMode`銆丟raph Lab 涓夋爮宸ヤ綔鍖恒€丳alette銆両nspector銆丼ource Drawer 涓?`graphEditService` 鍛戒护灞傦紝GUI 缂栬緫缁熶竴钀藉洖 `.mdstory` 骞跺鐢ㄨВ鏋愮绾裤€傛柊澧?Graph Lab E2E锛岄粯璁?app E2E 鏇存柊涓?30/30銆侲lectron 杩佺Щ鍒?42.5.0锛岀Щ闄?GHSA ignore锛宍pnpm.cmd audit --audit-level moderate` 鏃犲凡鐭ユ紡娲炪€備慨姝ｆ墦鍖呰剼鏈樉寮忓姞杞?`electron-builder.config.js`锛宍pnpm.cmd package:win` 鐢熸垚 `release/PlotFlow Setup 0.1.0.exe`锛宎sar 鎵弿纭涓嶅寘鍚?`website/`锛宲ackaged smoke 瑕嗙洊鍛戒护琛屾墦寮€銆丟raph Lab GUI 缂栬緫銆丼ource Drawer銆佸鍑?JSON銆?|
| 2026-06-24 | **Graph Lab 钃濆浘寮忕敾甯冧氦浜掑崌绾?*锛氭柊澧?`.mdstory` 鍙€?`layout.graph.nodes` 甯冨眬鎶曞奖锛岃妭鐐规嫋鎷藉疄鏃剁Щ鍔ㄥ苟鍦ㄦ澗鎵嬪啓鍥炲潗鏍囷紱绾跨紗鐑尯鏀逛负鍗＄墖搴曢儴姝ｅ父甯冨眬琛岋紝鏀寔鎷栧埌宸叉湁鑺傜偣杩炴帴銆佹嫋鍒扮┖鐧芥墦寮€鍔ㄤ綔鑿滃崟銆佸垱寤鸿妭鐐瑰苟杩炴帴銆佹嫋鏃㈡湁绾跨紗鍒扮┖鐧芥柇寮€銆侴raph Lab E2E 5/5 瑕嗙洊涓婅堪涓昏矾寰勩€?|
| 2026-06-25 | **瀹樻柟娣卞害涓婚鏋舵瀯涓庝富棰樺叆鍙?*锛氭柊澧?`OfficialThemeDefinition`銆佸畼鏂逛富棰?provider銆乣activeOfficialThemeId` 鎸佷箙鍖栦笌鏃?`themePack` 杩佺Щ銆傞鍙?`plotflow-narrative-workbench`锛堝彊浜嬪伐浣滃彴锛夊拰 `plotflow-neon-dossier`锛堝鑸摑鍥撅級锛孏raphCanvas 鑺傜偣/绾跨紗鏀圭敱褰撳墠瀹樻柟涓婚 slots 鎻愪緵銆傛柊澧?HomeSurface 涓?ThemeCenter锛孴opbar 鍜岄椤靛潎鍙繘鍏ヤ富棰樹腑蹇冿紝璐拱鍏ュ彛璺宠浆瀹樼綉锛屼骇鍝?UI 涓嶅啀鏆撮湶鏈湴涓婚鍖呭鍏ャ€傚畼缃戦椤垫柊澧炲畼鏂逛富棰樺睍绀恒€傛柊澧炲畼鏂逛富棰樺崟鍏冩祴璇曚笌 E2E锛岄獙璇佷富棰樹腑蹇冦€佹牴灞炴€с€佽妭鐐?slot銆乪dge slot 鍜屾牳蹇?CSS var 鐑垏鎹€傚綋鍓嶅畬鏁撮粯璁?app E2E 涓?39/39 passed銆?|
| 2026-06-30 | **Audit refresh and docs sync**: reviewed the current official theme platform changes. Confirmed `plotflow-engine-telemetry`, remote ZIP theme `plotflow-neon-dossier`, `plotflow-theme://` runtime loading, theme development standard docs, and blackbox GUI E2E are present. Verification: `pnpm.cmd lint` PASS with 0 error / 9 warnings; `pnpm.cmd typecheck` PASS; `pnpm.cmd test` PASS with 42 files / 1243 tests; `pnpm.cmd build` PASS; `pnpm.cmd lint:css` PASS; `pnpm.cmd --filter @plotflow/app test:e2e` PASS with 39/39; `pnpm.cmd --filter @plotflow/app test:e2e:blackbox` PASS with 8/8; `pnpm.cmd --dir website test` PASS; `website build:static + verify:static` PASS. Fixed `website/scripts/sync-project-status.mjs` release gate parsing and `verify-static.mjs` BOM JSON handling, then regenerated `website/public/data/project-status.json` and `website/dist-static/data/project-status.json`. |
| 2026-06-30 | **Release blackbox gate hardening**: added `spec/release-blackbox-gate.md`, extended blackbox launcher targets to `devBuild`, `winUnpacked`, and `installedExe`, and added high-risk installed-style guards for Graph Lab wire/drop interactions, native packaged export, visual/theme renderer drift, packaged resource scans, and installed `.mdstory` registry association. Source blackbox validation currently passes as 10 passed / 4 skipped; skipped checks require packaged or installed targets and must not be counted as formal release evidence. |
| 2026-07-01 | **Export false-success fix and unpacked blackbox validation**: fixed export default filename fallback so template placeholders such as `{{title}}` fall back to the current `.mdstory` basename, added main-process export/save write-back verification, hardened Windows native save dialog automation to target the actual Windows 11 `FileNameControlHost` save-dialog tree, cleared stale `release/` artifacts and old `D:\PF\PlotFlow` install directory, then regenerated Windows artifacts. Verification: `pnpm.cmd lint` PASS with 0 error / 9 existing warnings; `pnpm.cmd typecheck` PASS; `pnpm.cmd test -- ExportDialog mainProcessUtils` PASS with 43 files / 1248 tests; `pnpm.cmd --filter @plotflow/app test:e2e` PASS with 39/39; `pnpm.cmd --filter @plotflow/app test:e2e:blackbox` PASS with 10 passed / 4 skipped; `pnpm.cmd package:win` PASS; `pnpm.cmd --filter @plotflow/app test:e2e:unpacked` PASS with 13 passed / 1 installed-only skipped; `pnpm.cmd audit --audit-level moderate` PASS. Installed blackbox remains pending until the refreshed installer is installed. |
| 2026-07-01 | **Manual blackbox P1/P2 source fixes**: fixed Home hero overlap, Graph Lab referenced-node rename edge migration, diagnostics chip discoverability, save/save-as status priority, and primary English UI coverage. Verification: `pnpm.cmd lint` PASS with 0 error / 9 existing warnings; `pnpm.cmd typecheck` PASS; `pnpm.cmd test` PASS with 44 files / 1252 tests; `pnpm.cmd build` PASS with the existing Vite dynamic/static import warning; `pnpm.cmd lint:css` PASS; Graph Lab narrow E2E PASS with 13/13; export E2E PASS with 5/5; full app integration E2E PASS with 44/44; source blackbox PASS with 10 passed / 4 packaged-or-installed skips; `pnpm.cmd audit --audit-level moderate` PASS. No new package was generated in this pass, so unpacked/installed blackbox and manual patrol remain required before any release-candidate claim. |
| 2026-07-01 | **Clean Windows package output**: cleared old `release/` and `out/`, rebuilt Windows NSIS package, verified installer SHA256 `7E5F28B694D6065F27775027DD63CECD6349B3D9B0654DFCB9EEE1531D6840C7`, confirmed `app.asar` excludes `website/` and `dist-static`, and ran current unpacked blackbox. Verification: `pnpm.cmd package:win` PASS; `pnpm.cmd --filter @plotflow/app test:e2e:unpacked` PASS with 13 passed / 1 installed-only skipped. Installed blackbox remains pending until the new installer is installed. |
| 2026-07-01 | **Save-flow cancellation safety fix**: fixed save/open and save/new control flow so Save As cancellation or failure stops file replacement instead of continuing; moved Save As concurrency lock before the first await; distinguished Save As cancellation from real save errors; added Graph Lab E2E regressions for duplicate Save As prevention, save failure feedback, and cancellation blocking file open. Previous Windows package and unpacked blackbox are now stale and must be regenerated/rerun. |

---

*鏈枃妗ｆ瘡娆℃彁浜ゅ悗鏇存柊銆傞噷绋嬬瀹屾垚鏃跺悓姝ユ洿鏂?`CLAUDE.md` 涓殑闃舵鐘舵€併€俈0.3 璧锋湰鏂囦欢浣滀负鍞竴杩涘害鏉冨▉鏉ユ簮銆?
