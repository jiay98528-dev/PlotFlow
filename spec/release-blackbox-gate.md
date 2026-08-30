# PlotFlow Release Blackbox Gate

> Version: 2026-08-29 (historical evidence archived)
> Scope: Windows release validation
> Authority: this document applies only to explicit release-candidate or public-release claims. Ordinary implementation, review and local readiness do not require a formal evidence chain.

## Purpose

PlotFlow must not treat the default app E2E suite as a full release proof. The default suite is still valuable, but it can use internal test bridges and source-build assumptions. Release validation now has four separate layers:

ADR-012 makes Graph Lab the primary and default workspace. Release evidence must therefore prove a real Graph-first journey: first launch or file open enters Graph Lab, the user edits through visible GUI controls, saves to disk, restarts or continues editing, resolves diagnostics, and exports through the real file path without entering Split or using internal bridges. Split remains a required auxiliary-source regression, but a Split-first journey cannot substitute for the default-workspace proof.

| Layer | Command | Target | Internal bridge allowed | Release meaning |
|---|---|---|---|---|
| Integration E2E | `pnpm.cmd --filter @plotflow/app test:e2e` | source build / test harness | Yes | proves renderer/main integration behavior |
| Source blackbox | `pnpm.cmd --filter @plotflow/app test:e2e:blackbox` | `out/main/main.js` | No | proves visible GUI journeys without store or IPC shortcuts |
| Unpacked blackbox | `pnpm.cmd release:candidate:create`, then run `test:e2e:unpacked` with that command's exact `CANDIDATE_DIR` and `UNPACKED_EXE` outputs | `release/candidates/<version>/<commit>/<utc-run>/win-unpacked/Fablevia.exe` | No | proves the immutable candidate executable and resources behave like a user build |
| Installed blackbox | `$env:PLOTFLOW_INSTALLED_EXE = 'D:\PF\PlotFlow\PlotFlow.exe'` then `pnpm.cmd --filter @plotflow/app test:e2e:installed` | real installed app | No | proves the installed path, registered resources, and app launch path work |

If the unpacked or installed blackbox layers have not been run, report only the layers actually executed. Do not turn missing release evidence into a blocker for ordinary implementation, review, commits or source builds.

## Minimum Release Decision Policy

- A normal code change uses targeted tests proportional to the affected path. It does not require candidate packaging, a clean worktree, evidence commits, VM recording or independent-review packs.
- An unsigned Windows candidate requires source quality gates, candidate creation/verification, and the unpacked Graph-first blackbox against the same candidate directory.
- A release-candidate claim additionally requires installed blackbox coverage against that same candidate. Manual patrol is limited to high-risk paths not already covered by automation.
- A public Windows release additionally requires valid Authenticode signatures and verification of the final signed file hashes.
- The five-pack external-review workflow under `spec/external-review/` is optional and applies only when the user explicitly requests a formal independent review. Its reviewer, recording and tracked-evidence rules do not gate ordinary RC work.

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
- `remote-theme.spec.ts`: proves 0.1.1 never requests a registry and never executes a malicious preinstalled remote `index.mjs`; only the three bundled themes are exposed.
- `graph-lab-risk.spec.ts`: live wire preview, wire drop menu close behavior, Source Dock collapse, Split-only controls hidden in Graph Lab, and layout drift guard.
- `visual-risk.spec.ts`: viewport screenshots plus node/edge renderer marker changes across official themes.
- `file-dialogs.spec.ts`: packaged-app native JSON export through the real Windows save dialog.
- `packaged-artifacts.spec.ts`: app.asar exclusion scan, file icon presence, builder metadata, and installed `.mdstory` registry association.

Implemented in source integration E2E under `packages/app/e2e/` and required before release evidence can be trusted:

- Graph Lab P0/P1 coverage: recent-file `Continue editing`, single-file `vars:` editing, condition/effect variable dropdowns, node-level `下一步` flow exits, chapter source slices, and W007 closed-cycle diagnostics.
- Graph Lab visual coverage: chapter tab bar must be verified by Playwright screenshots before and after creating a chapter; DOM-only assertions are not sufficient because a fixed-height command bar can clip a rendered tab row.

## Historical Evidence

Archived to [`spec/release-evidence/blackbox-gate-history.md`](release-evidence/blackbox-gate-history.md): the 0.1.1 preview source snapshot, the superseded 2026-07 gate-snapshot table, and all dated repair/audit notes with per-run SHA256 identities. History is retained for traceability only; it does not gate current work.

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
- `.github/workflows/release-validation.yml` is the nightly/manual entry for a fresh Windows package, unpacked blackbox, 100/500/1000-node performance journeys and candidate identity verification. The package job refuses a dirty worktree and writes every run to a new `release/candidates/<version>/<full-commit>/<utc-run>/` directory that must not already exist. It never deletes or overwrites the legacy root `release/` contents.
- `candidate-manifest.json` is the authority for the unsigned candidate. It binds the full Git SHA, exact product/version/channel, `sourceDirty: false`, installer, unpacked executable and `win-unpacked/resources/app.asar` byte counts/SHA256 values, embedded versions, and applicable Authenticode states. `SHA256SUMS.txt` additionally binds that manifest. The verifier rejects dirty or different HEADs, path escapes including intermediate junctions, multiple installers, hash drift and version drift. The only valid pre-signing identity is `releaseChannel: preview`, `stage: preflight`, `status: UNSIGNED_PREFLIGHT`, and `readyForSigning: false`; it must not be interpreted as ready to sign or publicly release.
- The installed job is manual-only and requires the `windows-installed-release` protected environment plus a self-hosted Windows runner. Repository administrators must configure the environment approval rule and runner labels outside YAML.
- Before installed E2E starts, the job verifies the downloaded manifest against the checked-out full Git SHA, then recomputes the same-run installer and unpacked `Fablevia.exe` hashes and requires `NotSigned` Authenticode status. Signing changes executable bytes: after all pre-signing gates pass, the signed artifacts require a separate final manifest with new SHA256 and valid Authenticode evidence; unsigned hashes must never be presented as signed-artifact hashes.

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
- `Unpacked blackbox passed`: `test:e2e:unpacked` passed with `PLOTFLOW_BLACKBOX_RELEASE_ROOT` and `PLOTFLOW_BLACKBOX_UNPACKED_EXE` set to the same immutable candidate directory.
- `UNSIGNED_PREFLIGHT`: source gates and unpacked blackbox passed, then `release:candidate:verify` revalidated the clean HEAD, manifest, sums, embedded 0.1.1 versions and `NotSigned` executables. This status is not RC PASS, signing approval or public release.
- `Installed blackbox passed`: `test:e2e:installed` passed against the newly installed app path.
- `Release candidate passed`: source, unpacked and installed automated layers passed against the same candidate; any directly affected high-risk path not covered by automation also passed a focused manual check.
- `Public formal release passed`: release-candidate evidence is current and the distributed executables have valid Authenticode signatures. An unsigned package must never use this status.
