# PlotFlow Release Blackbox Gate

> Version: 2026-07-11
> Scope: Windows release validation
> Authority: release status must cite this document when claiming a build is ready.

## Purpose

PlotFlow must not treat the default app E2E suite as a full release proof. The default suite is still valuable, but it can use internal test bridges and source-build assumptions. Release validation now has four separate layers:

ADR-012 makes Graph Lab the primary and default workspace. Release evidence must therefore prove a real Graph-first journey: first launch or file open enters Graph Lab, the user edits through visible GUI controls, saves to disk, restarts or continues editing, resolves diagnostics, and exports through the real file path without entering Split or using internal bridges. Split remains a required auxiliary-source regression, but a Split-first journey cannot substitute for the default-workspace proof.

| Layer | Command | Target | Internal bridge allowed | Release meaning |
|---|---|---|---|---|
| Integration E2E | `pnpm.cmd --filter @plotflow/app test:e2e` | source build / test harness | Yes | proves renderer/main integration behavior |
| Source blackbox | `pnpm.cmd --filter @plotflow/app test:e2e:blackbox` | `out/main/main.js` | No | proves visible GUI journeys without store or IPC shortcuts |
| Unpacked blackbox | `pnpm.cmd package:win` then `pnpm.cmd --filter @plotflow/app test:e2e:unpacked` | `release/win-unpacked/PlotFlow.exe` | No | proves packaged executable and resources behave like a user build |
| Installed blackbox | `$env:PLOTFLOW_INSTALLED_EXE = 'D:\PF\PlotFlow\PlotFlow.exe'` then `pnpm.cmd --filter @plotflow/app test:e2e:installed` | real installed app | No | proves the installed path, registered resources, and app launch path work |

If the unpacked or installed blackbox layers have not been run, project documents may only say "source integration passed" or "source blackbox passed". They must not say "formal release passed".

## Blackbox Rules

Blackbox tests are forbidden from using:

- `__test_store__`
- direct `window.plotflow` calls
- `ipcMain` mocks or handler replacement
- localStorage state injection
- renderer store reads
- DOM state mutation
- `page.evaluate()` to inspect or mutate internal app state

Blackbox tests may use:

- visible UI locators, keyboard, mouse, and menu shortcuts
- command-line `.mdstory` file arguments
- real filesystem reads and writes
- Windows UIAutomation for native open/save/export dialogs
- local HTTP fixtures that behave as an external official theme registry
- screenshots, traces, videos, and external timing

## Current Implemented Coverage

Implemented in `packages/app/e2e-blackbox/`:

- `blackbox-contract.spec.ts`: prevents internal bridges from entering the blackbox suite.
- `journey.spec.ts`: includes a single continuous packaged Graph-first gate using a fresh user-data profile and the real Windows open/export dialogs. It opens a diagnostic fixture from Home, repairs E001 through the Inspector, edits through visible GUI controls, performs session-local undo/redo, saves, restarts the same profile, resumes through `Continue editing`, proves history was reset, and exports/validates Schema 0.2 without entering Split or using an internal bridge. Visible Monaco editing remains a separate auxiliary case.
- `edge-cases.spec.ts`: Unicode paths and rapid workspace/theme switching.
- `performance.spec.ts`: measures 100/500/1000 node stories opening directly into the default Graph Lab workspace with `RangeError` monitoring; Split switching is only an auxiliary path.
- `remote-theme.spec.ts`: official remote ZIP theme happy path and hash mismatch rejection.
- `graph-lab-risk.spec.ts`: live wire preview, wire drop menu close behavior, Source Dock collapse, Split-only controls hidden in Graph Lab, and layout drift guard.
- `visual-risk.spec.ts`: viewport screenshots plus node/edge renderer marker changes across official themes.
- `file-dialogs.spec.ts`: packaged-app native JSON export through the real Windows save dialog.
- `packaged-artifacts.spec.ts`: app.asar exclusion scan, file icon presence, builder metadata, and installed `.mdstory` registry association.

Implemented in source integration E2E under `packages/app/e2e/` and required before release evidence can be trusted:

- Graph Lab P0/P1 coverage: recent-file `Continue editing`, single-file `vars:` editing, condition/effect variable dropdowns, node-level `下一步` flow exits, chapter source slices, and W007 closed-cycle diagnostics.
- Graph Lab visual coverage: chapter tab bar must be verified by Playwright screenshots before and after creating a chapter; DOM-only assertions are not sufficient because a fixed-height command bar can clip a rendered tab row.

## Current Gate Snapshot

Last updated: 2026-07-11

| Layer | Status | Evidence |
|---|---|---|
| Local quality gates | Passed | Clean code revision `6faf4801a4f0d2d9a0d15fd2de46f092a2b918b0`; lint 0 errors / 9 existing warnings, typecheck, 72 files / 1385 unit tests, build, CSS/token/layer/bundle/UI-literal/mojibake/Schema/engine/website/audit gates all passed. |
| Integration E2E | Passed | 82/82 on the same code revision, including keyboard/a11y contracts, system-open tagged errors, drag/reload concurrency and 1440/1280/1180/1179/901/900/390 responsive boundaries. |
| Source blackbox | Passed | 11 passed / 6 target-specific skips. Native-dialog and packaged-artifact cases intentionally skip on the source target. |
| Unpacked blackbox | Passed | With the code tree clean, fresh `package:win` followed by 16 passed / 1 installed-only skip. The strict native Graph-first journey exported Schema 0.2 and validated the disk JSON with Ajv draft-2020-12. |
| Remote PR CI | Pending | Ubuntu quality gates and Windows App/source-blackbox/visual E2E require actual workflow runs for this revision. The PR must remain Draft until all required checks are green. |
| Installed blackbox | Pending | No installed executable exists at `D:\PF\PlotFlow\PlotFlow.exe` or the standard Program Files paths. An authorized interactive per-machine install is required before setting `$env:PLOTFLOW_INSTALLED_EXE` and running the suite. |

2026-07-11 Ready-review local evidence: the tested code revision is `6faf4801a4f0d2d9a0d15fd2de46f092a2b918b0`; `git status --porcelain` was empty before and after fresh packaging (`dirty=false`). The installer SHA256 is `65FA5E72BA31DB8232A7C39880D2F8796AC1766B44A45DD0F18B9C9D32A835C8`; the unpacked executable SHA256 is `3C29B1CF0B03C981D6636331BA7246704FC0968A6626B7D390DAB591FB2B95BB`. Both Authenticode statuses are `NotSigned`. This is sufficient local evidence to open a Draft code-review PR, but remote required checks still block Ready for Review; installed blackbox, real engine smoke, the 30-minute patrol and signing continue to block RC/public release.

2026-07-11 ADR-013 closure evidence: `lint` passed with 0 errors / 9 existing `no-console` warnings; `typecheck`, `build`, CSS/token/bundle lint and dependency audit passed; unit tests passed 60 files / 1356 tests; app E2E passed 74/74; source blackbox passed 11 / skipped 6; engine contract fixtures passed 6/6; a fresh Windows package was built; unpacked blackbox passed 16 / skipped 1. The strict unpacked journey used a fresh profile and native Open/Export dialogs, repaired E001 in Graph Lab, edited, undid/redid, saved, restarted, continued with empty history, and validated the exported disk JSON against Schema 0.2 with Ajv. Installer SHA256 is `9D574BA999192468D6509ACCD4331C2087D2F3866BE6AEB8E4F14764ABD257C0`; unpacked executable SHA256 is `0DC0CD993BB30D9398252F645816450F26DA36EE39C636CAB968790B5E708C94`. Authenticode status is `NotSigned`.

2026-07-11 ADR-014 local implementation evidence: `lint` passed with 0 errors / 9 existing warnings; `typecheck`, `build`, CSS/token/bundle/UI-literal/Schema mirror/website static and moderate+ audit gates passed; unit tests passed 68 files / 1376 tests; app E2E passed 79/79 including responsive geometry and multi-theme visual baselines; source blackbox passed 11 / skipped 6; engine contracts passed 6/6; fresh `package:win` produced a new installer; unpacked blackbox passed 16 / skipped 1 including the continuous native Open → Graph diagnostic repair → GUI edit → Undo/Redo → save → restart/Continue → native export → disk JSON Schema 0.2 validation journey. Installer SHA256 is `C65CFFD0131F8E400DC663EFAE19022BCAE504F5825FBFED8A7FCDDF09A6A51C`; unpacked executable SHA256 is `17B148B65333AD57E4748708DE5E1DAC3A6943C872282E694E7BCA358BB050BF`. Both Authenticode statuses are `NotSigned`. Remote Ubuntu/Windows/nightly runs, installed blackbox, 30-minute manual patrol and real engine toolchain smoke remain pending, so this is not a release-candidate pass.

Godot/Unity/Unreal consumption contracts have executable JSON fixture/static checks, but this machine lacks Godot/gdlint, Unity assemblies and UnrealBuildTool. Those real engine compiles remain manual release evidence, as do installed blackbox and the 30-minute installed-app patrol. Therefore this snapshot is an unpacked release candidate only; it is not an installed, release-candidate-passed, or public formal release claim.

2026-07-11 stale-package gate probe: the new strict journey was run once against the existing `win-unpacked` artifact. Native Open, visible E001 repair, Graph Inspector edit, session Undo/Redo, save, restart, Home `Continue editing`, empty-history assertion, and native JSON Export all completed. The test then failed at the intended contract boundary because the stale package exported `https://plotflow.dev/schema/0.1/story.json` instead of 0.2. This is a successful red-gate probe, not passing unpacked evidence; rebuild after the Schema 0.2 implementation and rerun the full suite.

2026-07-10 historical Graph-first package evidence: unit tests passed 57 files / 1334 tests; lint passed with 0 errors and 9 existing `no-console` warnings; typecheck, CSS/token/bundle lint, build, package, source blackbox, integration E2E, and unpacked blackbox passed. Installer SHA256 was `FA2DF86E9D22385FAECF9DDBAEFA0EBE8054B454A1608FD721D59383BA9CB7B8`; unpacked executable SHA256 was `73AA2B56ACC6562323C869843DC9651CB25A8EF516D327ECD918B1C46DE9A95B`. Both executables reported `NotSigned`. This evidence is retained for traceability but is stale for current source.

2026-07-10 Graph-first gate update: ADR-012 changed the authoritative default workspace and expanded the required journey. The 2026-07-09 snapshot above is historical evidence for the previous Split-first contract and does not by itself prove the new Graph-first release gate. Regenerate source/package evidence and run the full default-workspace journey before making any release-candidate claim.

2026-07-09 installed GUI blocker repair note: source fixes were applied for Source Drawer save-to-disk semantics, visible-draft flushing before save/replace/Graph Lab source mutations, stale Source Drawer blocking, external conflict overwrite hash preflight, Engine Telemetry bottom Source Drawer visibility, 1000-node large-graph fallback, natural chapter naming, Graph Lab create action reachability, and Home overlay behavior. Verified commands: `lint:tokens`, `typecheck`, `test` (50 files / 1286 tests), `lint` (0 errors / 9 existing warnings), `lint:css`, `build`, `@plotflow/app build`, `lint:bundle`, Graph Lab focused E2E, Engine Telemetry focused E2E, 1000-node blackbox performance, full app E2E 62/62, full source blackbox 10 passed / 4 skipped, `package:win`, and unpacked blackbox 13 passed / 1 installed-only skip. Installed blackbox and manual installed GUI patrol have not been rerun, so this is not a release-candidate pass.

2026-07-06 chapter-tab visibility update: source changed after the refreshed package/unpacked evidence above. The new source fix makes the Graph Lab chapter tab bar a dedicated visible command-bar row and adds screenshot-backed E2E assertions. Verified after the change: `typecheck`, `lint`, `lint:css`, `build`, `lint:tokens`, `lint:bundle`, Graph Lab narrow E2E 19/19, and targeted chapter-tab screenshot E2E 1/1. The earlier `package:win` and unpacked blackbox results are now stale for this newer source revision; rerun package/unpacked/installed before any release-candidate claim.

2026-07-06 external-audit P0/P1 closure note: latest source changes add recent-file resume, single-file global variable editing in Graph Lab, node-level `下一步` flow exits, source chapter slices, W007 closed-cycle warnings, and packaged native dialog ownership hardening. Verified commands include `lint:tokens`, `typecheck`, `test` (50 files / 1277 tests), `lint`, `lint:css`, `build`, `@plotflow/app build`, `lint:bundle`, Graph Lab narrow E2E, blackbox edge, full integration E2E, full source blackbox, `package:win`, targeted native export unpacked E2E, and full unpacked blackbox. `lint` still reports 9 existing `no-console` warnings and 0 errors. Installed blackbox and manual high-risk patrol have not been rerun, so this is not yet a release-candidate pass.

2026-07-03 architecture audit note: source/build fixes were applied for six release risks: shared `.mdstory` source boundary analysis, CRLF-preserving Graph Lab writeback, worker-backed graph layout with large-graph fast grid, current-file external modification conflict handling, TS/TSX token linting, and renderer bundle chunking/budget checks. Verified source gates: `lint`, `typecheck`, `test`, `lint:css`, `lint:tokens`, `build`, `@plotflow/app build`, and `lint:bundle`. Because source changed after all previous package evidence, all GUI/E2E blackbox layers are stale until rerun.

2026-07-01 export regression note: unpacked blackbox caught an installed-style export defect where the native save dialog could be driven with an unsafe default filename and the app could still report success without verifying disk output. The product fix now sanitizes placeholder filenames such as `{{title}}`, verifies save/export writes by reading the file back, and the blackbox native export journey must remain in the release gate.

2026-07-01 manual GUI audit note: installed/unpacked manual use found P1/P2 UX blockers in Home layout, Graph Lab target-node rename, diagnostics discoverability, save feedback, English UI coverage, and save-flow cancellation safety. Source fixes are covered by `graph-lab.e2e.spec.ts` narrow regression checks: Home two-theme/three-viewport overlap, diagnostics chip -> ProblemPanel, referenced-node rename without E001, Save As feedback within 300ms, duplicate Save As prevention, Save As failure feedback, Save As cancellation blocking file replacement, and English primary surfaces. The previous clean package is now stale because source changed after it was built; unpacked blackbox, installed blackbox, and manual patrol must be rerun before any release-candidate claim.

## Required Release Commands

Run these in order:

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd lint:css
pnpm.cmd lint:tokens
pnpm.cmd lint:bundle
pnpm.cmd --filter @plotflow/app test:e2e
pnpm.cmd --filter @plotflow/app test:e2e:blackbox
pnpm.cmd package:win
pnpm.cmd --filter @plotflow/app test:e2e:unpacked
$env:PLOTFLOW_INSTALLED_EXE = 'D:\PF\PlotFlow\PlotFlow.exe'
pnpm.cmd --filter @plotflow/app test:e2e:installed
pnpm.cmd audit --audit-level moderate
Remove-Item Env:PLOTFLOW_INSTALLED_EXE -ErrorAction SilentlyContinue
```

Installed blackbox requires the user or release engineer to install the newly built installer before running it. If `D:\PF\PlotFlow\PlotFlow.exe` still points to an older build, record the result as stale-installed evidence, not release evidence.

## Manual High-Risk Patrol

### Automated workflow policy (P2, implemented; remote runs pending)

- Pull requests use an Ubuntu quality job for source gates and a `windows-2022` job for app E2E, visual journeys and source blackbox. Failure artifacts retain Playwright trace, screenshots and video when present.
- `.github/workflows/release-validation.yml` is the nightly/manual entry for a fresh Windows package, unpacked blackbox, 100/500/1000-node performance journeys and a SHA256 manifest.
- The installed job is manual-only and requires the `windows-installed-release` protected environment plus a self-hosted Windows runner. Repository administrators must configure the environment approval rule and runner labels outside YAML.
- Before installed E2E starts, the job verifies the downloaded installer against the same-run SHA256 manifest, resolves the requested installed path outside the workspace, and verifies that installed `PlotFlow.exe` matches the same-run unpacked executable hash.

These workflow definitions are implementation configuration, not passing evidence. Do not update the Current Gate Snapshot until the corresponding run URL, revision and artifacts exist.

After automated gates pass, perform at least 30 minutes of installed-app use without reading the test report. Start from a clean user-data profile and complete the Graph-first items before entering Split. Required patrol items:

- Default path: first launch, New, Open, command-line open, and Home `Continue editing` all land in Graph Lab unless the user explicitly saved Split after the one-time migration.
- Graph-first persistence: create and edit through the GUI, undo/redo, save, restart, continue editing, fix a diagnostic, and export JSON/HTML/TXT without entering Split.
- Graph Lab: drag nodes, create nodes, connect, disconnect, reconnect, drag wire to empty canvas, close the drop menu with Esc and canvas click.
- Graph Lab chapters: create a chapter, verify a visible selected chapter tab appears, switch tabs, open Source Drawer, and confirm it edits only the active chapter slice.
- Graph Lab variables/effects: create and delete a `vars:` entry, then use it from both condition and effect editors.
- Graph Lab flow exits: create a node with no options, connect its default handle to another node, confirm source contains `下一步`, then add a normal option and confirm the default handle is hidden.
- Diagnostics: construct a closed A→B→A or A→B→C→A loop and confirm W007 appears; add a real external exit and confirm W007 no longer reports that loop.
- Source Dock: open and close repeatedly; verify it never hides the left rail, canvas, or Inspector.
- Split auxiliary path: explicitly switch to Split, verify the complete `.mdstory` source matches Graph Lab edits, and confirm Split-only branch graph controls never appear as global Graph Lab controls.
- Themes: switch official themes, restart, verify the selected theme and renderer differences persist.
- Files: open `.mdstory` by double-click or command line, edit, save, reopen, export JSON/HTML/TXT.
- Files: save a new `.mdstory`, restart, and verify Home `Continue editing` reloads the last saved file instead of silently falling back to an unsaved story.
- Close path: unsaved close dialog cancel/save/discard behavior.
- Installer: `.mdstory` icon/association, uninstall path, and default user-data retention.

Any blocking issue found manually must get a new blackbox or installed smoke test before the build can be called ready again.

## Status Vocabulary

- `Integration passed`: only `test:e2e` passed.
- `Source blackbox passed`: `test:e2e:blackbox` passed against `out/main/main.js`.
- `Unpacked blackbox passed`: `test:e2e:unpacked` passed against `release/win-unpacked/PlotFlow.exe`.
- `Installed blackbox passed`: `test:e2e:installed` passed against the newly installed app path.
- `Release candidate passed`: all automated layers, including the strict packaged Graph-first Schema 0.2 journey, plus the manual high-risk patrol passed against the same source revision and newly built package.
- `Public formal release passed`: release-candidate evidence is current and the distributed executables have valid Authenticode signatures. An unsigned package must never use this status.
