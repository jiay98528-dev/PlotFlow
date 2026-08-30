import { inflateRawSync } from 'node:zlib';

const MAX_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;

export function parseZipEntries(bytes) {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 65_557); offset <= bytes.length - 22; offset += 1) {
    if (bytes.readUInt32LE(offset) === eocdSignature && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) eocd = offset;
  }
  if (eocd < 0 || bytes.readUInt16LE(eocd + 4) !== 0 || bytes.readUInt16LE(eocd + 6) !== 0) throw new Error('Unsupported ZIP volume.');
  const count = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  if (count === 0 || centralOffset + centralSize > eocd) throw new Error('Invalid ZIP directory.');
  const entries = [];
  let cursor = centralOffset;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP central entry.');
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    if (cursor + 46 + nameLength + extraLength + commentLength > bytes.length) throw new Error('Truncated ZIP central entry.');
    if ((flags & 1) !== 0 || ![0, 8].includes(method) || uncompressedSize > MAX_ENTRY_BYTES) throw new Error('Unsafe ZIP entry.');
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString((flags & 0x800) !== 0 ? 'utf8' : 'latin1').replaceAll('\\', '/');
    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Invalid ZIP local entry.');
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > bytes.length) throw new Error('Truncated ZIP entry.');
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_ENTRY_BYTES });
    if (data.length !== uncompressedSize) throw new Error('ZIP entry size mismatch.');
    total += data.length;
    if (total > MAX_TOTAL_BYTES) throw new Error('ZIP evidence is too large.');
    entries.push({ name, isDirectory: name.endsWith('/'), data });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== centralOffset + centralSize) throw new Error('ZIP directory length mismatch.');
  return entries;
}
