// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type * as monaco from 'monaco-editor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';

const setupMocks = vi.hoisted(() => ({
  initMonacoEditor: vi.fn(),
  applyDiagnostics: vi.fn(),
  clearDiagnostics: vi.fn(),
}));
const saveMocks = vi.hoisted(() => ({
  debouncedSave: vi.fn(),
  saveOrSaveAs: vi.fn(),
}));
const pipelineMocks = vi.hoisted(() => ({
  debouncedParsePipeline: vi.fn(),
  parsePipelineNow: vi.fn(),
}));

vi.mock('../../editor/setupEditor', () => ({
  ...setupMocks,
  THEME_DARK: 'plotflow-dark',
  THEME_LIGHT: 'plotflow-light',
}));
vi.mock('../../services/autoSaveService', () => saveMocks);
vi.mock('../../services/parsePipeline', () => pipelineMocks);
vi.mock('../../services/graphHistoryService', () => ({ clearGraphHistory: vi.fn() }));
vi.mock('../../theme-platform/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../theme-platform/registry')>();
  return {
    ...actual,
    getThemeOrDefault: () => ({ defaultMode: 'light' }),
  };
});

import { MonacoEditor } from './MonacoEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

interface FakeEditor {
  readonly editor: monaco.editor.IStandaloneCodeEditor;
  readonly setValue: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
}

function createFakeEditor(initialValue: string): FakeEditor {
  let value = initialValue;
  let onChange: (() => void) | null = null;
  const setValue = vi.fn((nextValue: string) => {
    value = nextValue;
    onChange?.();
  });
  const dispose = vi.fn();
  const editor = {
    getValue: () => value,
    setValue,
    onDidChangeModelContent: (listener: () => void) => {
      onChange = listener;
      return { dispose: vi.fn() };
    },
    dispose,
  } as unknown as monaco.editor.IStandaloneCodeEditor;
  return { editor, setValue, dispose };
}

describe('MonacoEditor initialization', () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.getState().reset();
    useGraphStore.getState().setEditing(false);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mounted = false;
  });

  afterEach(() => {
    if (mounted) act(() => root.unmount());
    useEditorStore.getState().reset();
    document.body.replaceChildren();
  });

  it('hydrates the newest store content before user-change listeners are attached', async () => {
    let resolveEditor: ((editor: monaco.editor.IStandaloneCodeEditor) => void) | undefined;
    useEditorStore.getState().setContent('initial story');
    setupMocks.initMonacoEditor.mockImplementation(
      () =>
        new Promise<monaco.editor.IStandaloneCodeEditor>((resolve) => {
          resolveEditor = resolve;
        }),
    );

    act(() => {
      root.render(<MonacoEditor />);
    });
    mounted = true;
    expect(setupMocks.initMonacoEditor.mock.calls[0]?.[1]).toBe('initial story');

    act(() => useEditorStore.getState().setContent('newly opened story'));
    const fake = createFakeEditor('initial story');
    await act(async () => {
      resolveEditor?.(fake.editor);
      await Promise.resolve();
    });

    expect(fake.setValue).toHaveBeenCalledWith('newly opened story');
    expect(saveMocks.debouncedSave).not.toHaveBeenCalled();
    expect(pipelineMocks.debouncedParsePipeline).not.toHaveBeenCalled();
    expect(pipelineMocks.parsePipelineNow).toHaveBeenCalledWith('newly opened story');
    expect(useEditorStore.getState().editorInstance).toBe(fake.editor);
  });

  it('disposes a late editor without publishing it after unmount', async () => {
    let resolveEditor: ((editor: monaco.editor.IStandaloneCodeEditor) => void) | undefined;
    setupMocks.initMonacoEditor.mockImplementation(
      () =>
        new Promise<monaco.editor.IStandaloneCodeEditor>((resolve) => {
          resolveEditor = resolve;
        }),
    );

    act(() => {
      root.render(<MonacoEditor />);
    });
    mounted = true;
    act(() => root.unmount());
    mounted = false;

    const fake = createFakeEditor('');
    await act(async () => {
      resolveEditor?.(fake.editor);
      await Promise.resolve();
    });

    expect(fake.dispose).toHaveBeenCalledOnce();
    expect(useEditorStore.getState().editorInstance).toBeNull();
    expect(pipelineMocks.parsePipelineNow).not.toHaveBeenCalled();
    expect(saveMocks.debouncedSave).not.toHaveBeenCalled();
  });

  it('publishes an empty initial story to the parse pipeline', async () => {
    const fake = createFakeEditor('');
    setupMocks.initMonacoEditor.mockResolvedValue(fake.editor);

    await act(async () => {
      root.render(<MonacoEditor />);
      await Promise.resolve();
    });
    mounted = true;

    expect(pipelineMocks.parsePipelineNow).toHaveBeenCalledWith('');
  });
});
