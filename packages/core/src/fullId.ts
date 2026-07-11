/**
 * Canonical PlotFlow node identity helpers.
 *
 * Named chapter nodes use two percent-encoded components separated by `/`.
 * Anonymous chapter nodes use the encoded node component alone. Consumers
 * should treat the resulting value as an opaque key.
 */

export const ANONYMOUS_CHAPTER_ID = '_anonymous';

export function encodeFullIdComponent(value: string): string {
  // encodeURIComponent throws on lone UTF-16 surrogates. Parser inputs may
  // contain arbitrary/binary-like text, so normalize malformed pairs to U+FFFD
  // before encoding instead of allowing identity generation to crash.
  let wellFormed = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        wellFormed += value[index]! + value[index + 1]!;
        index += 1;
      } else {
        wellFormed += '\ufffd';
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      wellFormed += '\ufffd';
    } else {
      wellFormed += value[index]!;
    }
  }
  return encodeURIComponent(wellFormed);
}

export function createFullId(chapterId: string | null, nodeId: string): string {
  const encodedNodeId = encodeFullIdComponent(nodeId);
  if (!chapterId || chapterId === ANONYMOUS_CHAPTER_ID) return encodedNodeId;
  return `${encodeFullIdComponent(chapterId)}/${encodedNodeId}`;
}

/** Legacy pre-0.2 layout key. Only use this for migration lookups. */
export function legacyFullId(chapterId: string | null, nodeId: string): string {
  if (!chapterId || chapterId === ANONYMOUS_CHAPTER_ID) return nodeId;
  return `${chapterId}-${nodeId}`;
}
