import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const APP_ROOT = resolve(__dirname, '..', '..');
export const PROJECT_ROOT = resolve(APP_ROOT, '..', '..');
export const MAIN_SCRIPT = join(PROJECT_ROOT, 'out', 'main', 'main.js');
export const WIN_UNPACKED_EXE = join(PROJECT_ROOT, 'release', 'win-unpacked', 'PlotFlow.exe');

export type BlackboxLaunchTarget = 'devBuild' | 'winUnpacked' | 'installedExe';

export interface LaunchedBlackboxApp {
  readonly app: ElectronApplication;
  readonly page: Page;
  readonly target: BlackboxLaunchTarget;
  readonly executablePath: string | null;
  readonly userDataDir: string;
}

export interface LaunchBlackboxOptions {
  readonly storyPath?: string;
  readonly env?: Record<string, string>;
  readonly cwd?: string;
  readonly target?: BlackboxLaunchTarget;
}

export async function launchBlackboxApp(options: LaunchBlackboxOptions = {}): Promise<LaunchedBlackboxApp> {
  const target = options.target ?? getBlackboxTarget();
  const executablePath = getBlackboxExecutablePath(target);
  const electronArgs = getBlackboxArgs(target, options.storyPath);
  const userDataDir = await ensureDir(join(
    tmpdir(),
    `plotflow-blackbox-user-data-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  ));

  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  env['NODE_ENV'] = 'production';
  env['PLOTFLOW_BLACKBOX_E2E'] = '1';
  for (const [key, value] of Object.entries(options.env ?? {})) {
    env[key] = value;
  }
  if (process.env['PLOTFLOW_BLACKBOX_REAL_USER_DATA'] !== '1') {
    env['PLOTFLOW_TEST_USER_DATA_DIR'] = userDataDir;
  }

  const launchOptions = {
    args: electronArgs,
    executablePath: executablePath ?? undefined,
    cwd: options.cwd ?? (executablePath ? dirname(executablePath) : PROJECT_ROOT),
    env,
  };

  const app = await electron.launch(launchOptions as Parameters<typeof electron.launch>[0]);

  const page = await app.firstWindow();
  page.setDefaultTimeout(15_000);
  await waitForAppReady(page);
  return { app, page, target, executablePath, userDataDir };
}

export function getBlackboxTarget(): BlackboxLaunchTarget {
  const raw = process.env['PLOTFLOW_BLACKBOX_TARGET'] ?? 'devBuild';
  if (raw === 'devBuild' || raw === 'winUnpacked' || raw === 'installedExe') {
    return raw;
  }
  throw new Error(`Unsupported PLOTFLOW_BLACKBOX_TARGET: ${raw}`);
}

export function getBlackboxExecutablePath(target: BlackboxLaunchTarget = getBlackboxTarget()): string | null {
  if (target === 'devBuild') return null;
  const executablePath = target === 'winUnpacked'
    ? WIN_UNPACKED_EXE
    : resolveInstalledExecutablePath();
  if (!existsSync(executablePath)) {
    throw new Error(`Blackbox launch target ${target} executable does not exist: ${executablePath}`);
  }
  return executablePath;
}

export function getBlackboxArgs(target: BlackboxLaunchTarget, storyPath?: string): string[] {
  const args = target === 'devBuild'
    ? [existsSync(MAIN_SCRIPT) ? MAIN_SCRIPT : PROJECT_ROOT]
    : [];
  if (storyPath) {
    args.push(storyPath);
  }
  return args;
}

export function resolveInstalledExecutablePath(): string {
  const configured = process.env['PLOTFLOW_INSTALLED_EXE'];
  if (!configured) {
    throw new Error('PLOTFLOW_INSTALLED_EXE must point to the installed PlotFlow.exe when PLOTFLOW_BLACKBOX_TARGET=installedExe.');
  }
  return resolve(configured);
}

export function getBlackboxArtifactRoot(target: BlackboxLaunchTarget = getBlackboxTarget()): string | null {
  const executablePath = getBlackboxExecutablePath(target);
  return executablePath ? dirname(executablePath) : null;
}

export async function assertBlackboxNoFatalShell(page: Page): Promise<void> {
  await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('body').waitFor({ state: 'visible', timeout: 30_000 });
  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
  if (/white screen|fatal error|uncaught exception/i.test(bodyText)) {
    throw new Error(`Fatal shell text detected: ${bodyText.slice(0, 500)}`);
  }
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 30_000 });
}

export async function closeBlackboxApp(app: ElectronApplication): Promise<void> {
  const isCleanupError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return /closed|destroyed|crashed|Target page|browser has been closed|Process exited/i.test(message);
  };
  const withTimeout = async (promise: Promise<unknown>, timeoutMs: number, label: string): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const waitForProcessExit = async (child: ChildProcess, timeoutMs: number): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  };
  const forceKillProcessTree = async (child: ChildProcess): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === 'win32' && child.pid) {
      await new Promise<void>((resolve) => {
        execFile(
          'taskkill',
          ['/pid', String(child.pid), '/T', '/F'],
          { windowsHide: true },
          () => resolve(),
        );
      });
      return;
    }
    child.kill('SIGKILL');
  };

  const closePromise = app.close();
  void closePromise.catch(() => {});
  try {
    await withTimeout(closePromise, 5_000, 'blackbox app.close');
    return;
  } catch (error) {
    if (!isCleanupError(error) && !(error instanceof Error && /timed out/.test(error.message))) {
      throw error;
    }
  }

  const child = app.process();
  await forceKillProcessTree(child);
  await waitForProcessExit(child, 3_000);
  await withTimeout(closePromise.catch(() => undefined), 5_000, 'blackbox app.close after kill').catch(() => {});
}

export async function ensureDir(path: string): Promise<string> {
  await mkdir(path, { recursive: true });
  return path;
}

export async function dismissHomeIfVisible(page: Page): Promise<void> {
  const home = page.getByTestId('home-surface');
  if (!(await home.isVisible().catch(() => false))) return;
  await home.locator('.button--primary').first().click();
  await home.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
}

export async function closeThemeCenterIfVisible(page: Page): Promise<void> {
  const themeCenter = page.getByTestId('theme-center');
  if (!(await themeCenter.isVisible().catch(() => false))) return;
  await themeCenter.locator('.theme-center__header .icon-button').click();
  await themeCenter.waitFor({ state: 'hidden', timeout: 10_000 });
}

export async function switchToSplit(page: Page): Promise<void> {
  await page.getByTestId('workspace-mode-split').click();
  await page.locator('[data-theme-surface="split-shell"], .split-workspace').first().waitFor({ state: 'visible' });
}

export async function switchToGraphLab(page: Page): Promise<void> {
  await page.getByTestId('workspace-mode-graph-lab').click();
  await page.getByTestId('graph-lab-workspace').waitFor({ state: 'visible' });
}

export async function ensureSplitGraphVisible(page: Page): Promise<void> {
  const graphPane = page.locator('.graph-pane');
  if (await graphPane.isVisible().catch(() => false)) return;
  await page.getByTestId('toolbar-graph-view-toggle').click();
  await graphPane.waitFor({ state: 'visible' });
}

export async function focusMonaco(page: Page): Promise<void> {
  const editor = page.locator('.monaco-editor').first();
  await editor.waitFor({ state: 'visible' });
  await editor.click();
  await editor.locator('textarea').first().focus();
}

export async function waitForGraphNode(page: Page, text: string | RegExp): Promise<void> {
  await page.locator('.react-flow__node, .official-graph-node').filter({ hasText: text }).first().waitFor({ state: 'visible' });
}

export async function waitForAnyGraphNode(page: Page): Promise<void> {
  await page.locator('.react-flow__node, .official-graph-node').first().waitFor({ state: 'visible' });
}
