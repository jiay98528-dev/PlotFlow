import { parseStory, validate, type Diagnostic, type PlotFlowData } from '@plotflow/core';

export interface StoryIdentity {
  readonly storySessionId: number;
  readonly contentRevision: number;
  readonly sourceDraftRevision: number;
}

export interface PreparedStorySnapshot {
  readonly identity: StoryIdentity;
  readonly content: string;
  readonly data: PlotFlowData;
  readonly diagnostics: readonly Diagnostic[];
}

export type StorySnapshotBuildResult =
  | { readonly ok: true; readonly snapshot: PreparedStorySnapshot }
  | { readonly ok: false; readonly error: unknown };

export function sameStoryIdentity(left: StoryIdentity, right: StoryIdentity): boolean {
  return (
    left.storySessionId === right.storySessionId &&
    left.contentRevision === right.contentRevision &&
    left.sourceDraftRevision === right.sourceDraftRevision
  );
}

/** Identity used by read-only UI work that cannot consume or commit a Source draft. */
export function sameCanonicalStoryIdentity(left: StoryIdentity, right: StoryIdentity): boolean {
  return (
    left.storySessionId === right.storySessionId && left.contentRevision === right.contentRevision
  );
}

export function createStorySnapshot(
  content: string,
  identity: StoryIdentity,
): StorySnapshotBuildResult {
  try {
    const parsed = parseStory(content);
    if (!parsed.ok) {
      return { ok: false, error: new Error('Story parser did not produce an AST') };
    }

    const validation = validate(parsed.data);
    const validationDiagnostics = validation.ok ? validation.diagnostics : validation.errors;
    const seen = new Map<string, Diagnostic>();
    for (const diagnostic of [...parsed.diagnostics, ...validationDiagnostics]) {
      const key = `${diagnostic.code}:${diagnostic.range.startLine}:${diagnostic.range.startColumn}`;
      if (!seen.has(key)) seen.set(key, diagnostic);
    }

    const snapshot: PreparedStorySnapshot = {
      identity: Object.freeze({ ...identity }),
      content,
      data: parsed.data,
      diagnostics: Object.freeze([...seen.values()]),
    };
    return { ok: true, snapshot: Object.freeze(snapshot) };
  } catch (error) {
    return { ok: false, error };
  }
}
