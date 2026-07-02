# PlotFlow Release Blackbox Gate

> Version: 2026-06-30
> Scope: Windows release validation
> Authority: release status must cite this document when claiming a build is ready.

## Purpose

PlotFlow must not treat the default app E2E suite as a full release proof. The default suite is still valuable, but it can use internal test bridges and source-build assumptions. Release validation now has four separate layers:

| Layer | Command | Target | Internal bridge allowed | Release meaning |
|---|---|---|---|---|
| Integration E2E | `pnpm.cmd --filter @plotflow/app test:e2e` | source build / test harness | Yes | proves renderer/main integration behavior |
| Source blackbox | `pnpm.cmd --filter @plotflow/app test:e2e:blackbox` | `out/main/main.js` | No | proves visible GUI journeys without store or IPC shortcuts |
| Unpacked blackbox | `pnpm.cmd package:win` then `pnpm.cmd --filter @plotflow/app test:e2e:unpacked` | `release/win-unpacked/PlotFlow.exe` | No | proves packaged executable and resources behave like a user build |
| Installed blackbox | `set PLOTFLOW_INSTALLED_EXE=D:\PF\PlotFlow\PlotFlow.exe` then `pnpm.cmd --filter @plotflow/app test:e2e:installed` | real installed app | No | proves the installed path, registered resources, and app launch path work |

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
- `journey.spec.ts`: command-line open, visible Monaco edit, save, reopen, Graph Lab controls.
- `edge-cases.spec.ts`: Unicode paths and rapid workspace/theme switching.
- `performance.spec.ts`: 100/500 node open and Graph Lab switch thresholds.
- `remote-theme.spec.ts`: official remote ZIP theme happy path and hash mismatch rejection.
- `graph-lab-risk.spec.ts`: live wire preview, wire drop menu close behavior, Source Dock collapse, Split-only controls hidden in Graph Lab, and layout drift guard.
- `visual-risk.spec.ts`: viewport screenshots plus node/edge renderer marker changes across official themes.
- `file-dialogs.spec.ts`: packaged-app native JSON export through the real Windows save dialog.
- `packaged-artifacts.spec.ts`: app.asar exclusion scan, file icon presence, builder metadata, and installed `.mdstory` registry association.

## Current Gate Snapshot

Last updated: 2026-07-01

| Layer | Status | Evidence |
|---|---|---|
| Integration E2E | Passed | `pnpm.cmd --filter @plotflow/app test:e2e` -> 49 passed after the latest save-flow fix. |
| Source blackbox | Passed | `pnpm.cmd --filter @plotflow/app test:e2e:blackbox` -> 10 passed / 4 packaged-or-installed skips after clearing the blocking unsaved dialog. |
| Unpacked blackbox | Stale | Last clean package predates the latest save-flow fix. Rebuild with `pnpm.cmd package:win` and rerun `test:e2e:unpacked`. |
| Installed blackbox | Pending | Requires installing the refreshed `PlotFlow Setup 0.1.0.exe` and setting `PLOTFLOW_INSTALLED_EXE`. |

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
pnpm.cmd --filter @plotflow/app test:e2e
pnpm.cmd --filter @plotflow/app test:e2e:blackbox
pnpm.cmd package:win
pnpm.cmd --filter @plotflow/app test:e2e:unpacked
set PLOTFLOW_INSTALLED_EXE=D:\PF\PlotFlow\PlotFlow.exe
pnpm.cmd --filter @plotflow/app test:e2e:installed
pnpm.cmd audit --audit-level moderate
```

Installed blackbox requires the user or release engineer to install the newly built installer before running it. If `D:\PF\PlotFlow\PlotFlow.exe` still points to an older build, record the result as stale-installed evidence, not release evidence.

## Manual High-Risk Patrol

After automated gates pass, perform at least 30 minutes of installed-app use without reading the test report. Required patrol items:

- Graph Lab: drag nodes, create nodes, connect, disconnect, reconnect, drag wire to empty canvas, close the drop menu with Esc and canvas click.
- Source Dock: open and close repeatedly; verify it never hides the left rail, canvas, or Inspector.
- Split: verify Split-only branch graph controls are local to Split and never appear as global Graph Lab controls.
- Themes: switch official themes, restart, verify the selected theme and renderer differences persist.
- Files: open `.mdstory` by double-click or command line, edit, save, reopen, export JSON/HTML/TXT.
- Close path: unsaved close dialog cancel/save/discard behavior.
- Installer: `.mdstory` icon/association, uninstall path, and default user-data retention.

Any blocking issue found manually must get a new blackbox or installed smoke test before the build can be called ready again.

## Status Vocabulary

- `Integration passed`: only `test:e2e` passed.
- `Source blackbox passed`: `test:e2e:blackbox` passed against `out/main/main.js`.
- `Unpacked blackbox passed`: `test:e2e:unpacked` passed against `release/win-unpacked/PlotFlow.exe`.
- `Installed blackbox passed`: `test:e2e:installed` passed against the newly installed app path.
- `Release candidate passed`: all layers plus manual high-risk patrol passed.
