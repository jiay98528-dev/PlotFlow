import React, { Fragment, createElement } from 'react';
import type {
  InstalledOfficialThemeSummary,
  OfficialThemeRuntimeHost,
  OfficialThemeRuntimeModule,
  OfficialThemeRuntimeResult,
  ThemeDescriptor,
} from '../theme-platform/types';
import { narrativeWorkbenchSlots } from './builtin/plotflow-narrative-workbench/slots';
import { defaultThemeSurfaces } from './surfaces/defaultSurfaces';

const OFFICIAL_THEME_API_VERSION = 1;

function normalizeRuntimeAssetPath(input: string): string {
  const raw = input.trim();
  if (
    raw.length === 0 ||
    raw.includes('\0') ||
    raw.startsWith('/') ||
    raw.startsWith('\\') ||
    /^[a-zA-Z]:/.test(raw) ||
    raw.includes('://')
  ) {
    throw new Error(`非法官方主题资源路径: ${input}`);
  }
  const parts = raw.replace(/\\/g, '/').split('/').filter(Boolean);
  for (const part of parts) {
    if (part === '.' || part === '..') {
      throw new Error(`官方主题资源路径越界: ${input}`);
    }
  }
  return parts.map(encodeURIComponent).join('/');
}

function assetUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${normalizeRuntimeAssetPath(path)}`;
}

function injectRemoteStyleLink(themeId: string, href: string): void {
  if (typeof document === 'undefined') return;
  const id = `official-theme-style-link-${themeId}-${btoa(href).replace(/=+$/g, '')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset['officialThemeStyle'] = themeId;
  document.head.appendChild(link);
}

function injectRemoteCssText(themeId: string, cssText: string): void {
  if (typeof document === 'undefined') return;
  if (cssText.trim().length === 0) return;
  const id = `official-theme-css-text-${themeId}`;
  const existing = document.getElementById(id);
  if (existing) {
    existing.textContent = cssText;
    return;
  }
  const style = document.createElement('style');
  style.id = id;
  style.dataset['officialThemeStyle'] = themeId;
  style.textContent = cssText;
  document.head.appendChild(style);
}

function assertThemeDescriptor(value: unknown, summary: InstalledOfficialThemeSummary): ThemeDescriptor {
  if (!value || typeof value !== 'object') {
    throw new Error(`官方主题 ${summary.id} 未返回 descriptor`);
  }
  const descriptor = value as ThemeDescriptor;
  if (descriptor.id !== summary.id) {
    throw new Error(`官方主题 ${summary.id} descriptor id 不一致`);
  }
  if (descriptor.version !== summary.version) {
    throw new Error(`官方主题 ${summary.id} descriptor version 不一致`);
  }
  if (descriptor.storeMeta.availability !== 'officialRemote') {
    throw new Error(`官方主题 ${summary.id} 必须声明为 officialRemote`);
  }
  if (
    typeof descriptor.slots?.StoryNodeCard !== 'function' ||
    typeof descriptor.slots.StoryEdge !== 'function' ||
    typeof descriptor.slots.ThemePreview !== 'function' ||
    typeof descriptor.slots.HomePreview !== 'function'
  ) {
    throw new Error(`官方主题 ${summary.id} 缺少完整 slots`);
  }
  if (
    typeof descriptor.surfaces?.AppShell !== 'function' ||
    typeof descriptor.surfaces.Toolbar !== 'function' ||
    typeof descriptor.surfaces.SplitShell !== 'function' ||
    typeof descriptor.surfaces.GraphLabShell !== 'function' ||
    typeof descriptor.surfaces.HomeSurface !== 'function' ||
    typeof descriptor.surfaces.ThemeCenterSurface !== 'function' ||
    typeof descriptor.surfaces.PanelFrame !== 'function' ||
    typeof descriptor.surfaces.DockFrame !== 'function'
  ) {
    throw new Error(`官方主题 ${summary.id} 缺少完整 surfaces`);
  }
  return descriptor;
}

function createHost(summary: InstalledOfficialThemeSummary): OfficialThemeRuntimeHost {
  return {
    React,
    createElement,
    Fragment,
    defaultThemeSurfaces,
    baseSlots: narrativeWorkbenchSlots,
    assetUrl: (path: string) => assetUrl(summary.runtime.assetBaseUrl, path),
    themeId: summary.id,
    version: summary.version,
    apiVersion: OFFICIAL_THEME_API_VERSION,
  };
}

export async function loadOfficialThemeRuntimeModule(moduleUrl: string): Promise<OfficialThemeRuntimeModule> {
  return import(/* @vite-ignore */ moduleUrl) as Promise<OfficialThemeRuntimeModule>;
}

export async function createInstalledOfficialThemeDescriptor(
  summary: InstalledOfficialThemeSummary,
  runtimeModule: OfficialThemeRuntimeModule,
): Promise<ThemeDescriptor> {
  if (typeof runtimeModule.createTheme !== 'function') {
    throw new Error(`官方主题 ${summary.id} 缺少 createTheme(host)`);
  }

  const result: OfficialThemeRuntimeResult = await runtimeModule.createTheme(createHost(summary));
  const descriptor = assertThemeDescriptor(result.descriptor, summary);

  for (const href of summary.runtime.styleUrls) {
    injectRemoteStyleLink(summary.id, href);
  }
  for (const href of result.styleUrls ?? []) {
    injectRemoteStyleLink(summary.id, href);
  }
  if (result.cssText) {
    injectRemoteCssText(summary.id, result.cssText);
  }

  return descriptor;
}

export async function getInstalledOfficialThemeDescriptor(
  summary: InstalledOfficialThemeSummary,
): Promise<ThemeDescriptor | null> {
  try {
    const runtimeModule = await loadOfficialThemeRuntimeModule(summary.runtime.moduleUrl);
    return await createInstalledOfficialThemeDescriptor(summary, runtimeModule);
  } catch {
    return null;
  }
}
