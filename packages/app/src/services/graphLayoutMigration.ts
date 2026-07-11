import {
  analyzeStorySource,
  legacyFullId,
  normalizeStorySource,
  parseStory,
  restoreStoryNewline,
} from '@plotflow/core';

function readYamlString(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') return parsed;
    } catch {
      return trimmed;
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

/**
 * Rewrites uniquely resolvable pre-0.2 graph layout IDs to canonical IDs.
 * Ambiguous and unknown keys are deliberately retained for user recovery.
 */
export function migrateLegacyGraphLayoutKeys(content: string): string {
  const normalized = normalizeStorySource(content);
  const source = analyzeStorySource(normalized);
  if (!source.layout) return content;

  const parsed = parseStory(normalized);
  if (!parsed.ok) return content;
  const nodes = parsed.data.chapters.flatMap((chapter) => chapter.nodes);
  const canonicalIds = new Set(nodes.map((node) => node.fullId));
  const legacyMatches = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const key = legacyFullId(node.chapterId, node.id);
    const matches = legacyMatches.get(key) ?? [];
    matches.push(node);
    legacyMatches.set(key, matches);
  }

  const block = normalized.slice(source.layout.startOffset, source.layout.endOffset);
  const migratedBlock = block.replace(
    /(^\s*-\s+id:\s*)(.+)$/gmu,
    (line, prefix: string, rawId: string) => {
      const id = readYamlString(rawId);
      if (canonicalIds.has(id)) return line;
      const matches = legacyMatches.get(id);
      if (matches?.length !== 1) return line;
      return `${prefix}${JSON.stringify(matches[0]!.fullId)}`;
    },
  );
  if (migratedBlock === block) return content;

  const migrated = `${normalized.slice(0, source.layout.startOffset)}${migratedBlock}${normalized.slice(source.layout.endOffset)}`;
  return restoreStoryNewline(content, migrated);
}
