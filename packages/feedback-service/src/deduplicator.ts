import { randomUUID } from 'node:crypto';
import { FEEDBACK_REQUEST_ID_TTL_MS } from './protocol.js';

interface DedupeRecord {
  readonly reportId: string;
  readonly operation: Promise<void>;
  state: 'pending' | 'persisting' | 'undurable' | 'accepted';
  durabilityRetry: Promise<void> | null;
  succeededAt: number | null;
  expiresAt: number;
}

export interface PersistedDedupeEntry {
  readonly requestId: string;
  readonly reportId: string;
  readonly succeededAt: number;
}

export interface DedupePersistence {
  load: () => Promise<readonly PersistedDedupeEntry[]>;
  save: (entries: readonly PersistedDedupeEntry[]) => Promise<void>;
}

export class DedupePersistenceError extends Error {
  override readonly name = 'DedupePersistenceError';

  constructor(cause: unknown) {
    super('Could not persist feedback idempotency state', { cause });
  }
}

export interface DedupeResult {
  readonly status: 'accepted' | 'duplicate';
  readonly reportId: string;
}

/** Idempotency cache with optional durable success records; concurrent copies share one send. */
export class RequestDeduplicator {
  readonly #records = new Map<string, DedupeRecord>();
  #initialization: Promise<void> | null = null;
  #persistenceQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly ttlMs = FEEDBACK_REQUEST_ID_TTL_MS,
    private readonly now: () => number = Date.now,
    private readonly createReportId: () => string = () => `FB-${randomUUID()}`,
    private readonly persistence?: DedupePersistence,
  ) {}

  initialize(): Promise<void> {
    this.#initialization ??= this.#loadPersistedEntries();
    return this.#initialization;
  }

  async find(requestId: string): Promise<string | null> {
    await this.initialize();
    this.#prune();
    const record = this.#records.get(requestId);
    if (!record) return null;
    await this.#awaitDurable(record);
    return record.reportId;
  }

  async execute(
    requestId: string,
    operation: (reportId: string) => Promise<void>,
  ): Promise<DedupeResult> {
    await this.initialize();
    this.#prune();
    const existing = this.#records.get(requestId);
    if (existing) {
      await this.#awaitDurable(existing);
      return { status: 'duplicate', reportId: existing.reportId };
    }

    const reportId = this.createReportId();
    let deliverySucceeded = false;
    const recordHolder: { current?: DedupeRecord } = {};
    const completion = (async () => {
      await operation(reportId);
      deliverySucceeded = true;
      const activeRecord = recordHolder.current;
      if (!activeRecord) throw new Error('Feedback dedupe record was not registered');
      activeRecord.state = 'persisting';
      activeRecord.succeededAt = this.now();
      activeRecord.expiresAt = activeRecord.succeededAt + this.ttlMs;
      try {
        await this.#persistAcceptedEntries();
        activeRecord.state = 'accepted';
      } catch (error) {
        // The SMTP delivery succeeded. Retain the mapping in memory so a retry in this
        // process retries only the state write, while the caller receives unavailable.
        activeRecord.state = 'undurable';
        throw new DedupePersistenceError(error);
      }
    })();
    const registeredRecord: DedupeRecord = {
      reportId,
      operation: completion,
      state: 'pending',
      durabilityRetry: null,
      succeededAt: null,
      expiresAt: Number.POSITIVE_INFINITY,
    };
    recordHolder.current = registeredRecord;
    this.#records.set(requestId, registeredRecord);

    try {
      await completion;
      return { status: 'accepted', reportId };
    } catch (error) {
      if (!deliverySucceeded && this.#records.get(requestId) === registeredRecord) {
        this.#records.delete(requestId);
      }
      throw error;
    }
  }

  #prune(): void {
    const currentTime = this.now();
    for (const [requestId, record] of this.#records) {
      if (record.expiresAt <= currentTime) this.#records.delete(requestId);
    }
  }

  async #loadPersistedEntries(): Promise<void> {
    if (!this.persistence) return;
    const entries = await this.persistence.load();
    const currentTime = this.now();
    let removedExpiredEntry = false;
    for (const entry of entries) {
      const expiresAt = entry.succeededAt + this.ttlMs;
      if (expiresAt <= currentTime) {
        removedExpiredEntry = true;
        continue;
      }
      this.#records.set(entry.requestId, {
        reportId: entry.reportId,
        operation: Promise.resolve(),
        state: 'accepted',
        durabilityRetry: null,
        succeededAt: entry.succeededAt,
        expiresAt,
      });
    }
    if (removedExpiredEntry) await this.#persistAcceptedEntries();
  }

  #persistAcceptedEntries(): Promise<void> {
    if (!this.persistence) return Promise.resolve();
    const write = this.#persistenceQueue
      .catch(() => undefined)
      .then(async () => {
        this.#prune();
        const entries: PersistedDedupeEntry[] = [];
        for (const [requestId, record] of this.#records) {
          if (record.state === 'pending' || record.succeededAt === null) continue;
          entries.push({ requestId, reportId: record.reportId, succeededAt: record.succeededAt });
        }
        entries.sort((left, right) => left.requestId.localeCompare(right.requestId));
        await this.persistence?.save(entries);
      });
    this.#persistenceQueue = write;
    return write;
  }

  async #awaitDurable(record: DedupeRecord): Promise<void> {
    if (record.state === 'accepted') return;
    if (record.state === 'pending' || record.state === 'persisting') {
      await record.operation;
      return;
    }

    record.durabilityRetry ??= (async () => {
      try {
        await this.#persistAcceptedEntries();
        record.state = 'accepted';
      } catch (error) {
        throw new DedupePersistenceError(error);
      } finally {
        record.durabilityRetry = null;
      }
    })();
    await record.durabilityRetry;
  }
}
