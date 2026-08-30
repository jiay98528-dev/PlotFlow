import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DedupePersistence, PersistedDedupeEntry } from './deduplicator.js';

const STATE_FILE_NAME = 'successful-request-ids.json';
const STATE_FILE_VERSION = 1;

interface PersistedDedupeDocument {
  readonly version: typeof STATE_FILE_VERSION;
  readonly records: readonly PersistedDedupeEntry[];
}

function isPersistedEntry(value: unknown): value is PersistedDedupeEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).sort().join(',') === 'reportId,requestId,succeededAt' &&
    typeof record['requestId'] === 'string' &&
    typeof record['reportId'] === 'string' &&
    typeof record['succeededAt'] === 'number' &&
    Number.isSafeInteger(record['succeededAt']) &&
    record['succeededAt'] >= 0
  );
}

function parseDocument(source: string): readonly PersistedDedupeEntry[] {
  const parsed = JSON.parse(source) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid feedback idempotency state');
  }
  const document = parsed as Record<string, unknown>;
  if (
    Object.keys(document).sort().join(',') !== 'records,version' ||
    document['version'] !== STATE_FILE_VERSION ||
    !Array.isArray(document['records']) ||
    !document['records'].every(isPersistedEntry)
  ) {
    throw new Error('Invalid feedback idempotency state');
  }
  return document['records'];
}

/** Atomic JSON persistence containing only successful request IDs, report IDs and timestamps. */
export class JsonFileDedupePersistence implements DedupePersistence {
  readonly #statePath: string;

  constructor(private readonly stateDirectory: string) {
    this.#statePath = join(stateDirectory, STATE_FILE_NAME);
  }

  async load(): Promise<readonly PersistedDedupeEntry[]> {
    let source: string;
    try {
      source = await readFile(this.#statePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return parseDocument(source);
  }

  async save(entries: readonly PersistedDedupeEntry[]): Promise<void> {
    await mkdir(this.stateDirectory, { recursive: true, mode: 0o700 });
    const document: PersistedDedupeDocument = { version: STATE_FILE_VERSION, records: entries };
    const temporaryPath = join(
      this.stateDirectory,
      `.${STATE_FILE_NAME}.${process.pid}.${randomUUID()}.tmp`,
    );
    try {
      await writeFile(temporaryPath, `${JSON.stringify(document)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      await rename(temporaryPath, this.#statePath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
