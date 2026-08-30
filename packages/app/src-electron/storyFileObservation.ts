export interface InternalStoryWriteToken {
  readonly id: number;
  readonly hash: string;
}

export interface StoryFileObservation {
  readonly changed: boolean;
  readonly shouldNotify: boolean;
}

/**
 * Separates the last value actually observed on disk from one-shot hashes that
 * the main process is currently writing. A hash is never a permanent ignore
 * value, so an external A -> B -> A sequence remains observable.
 */
export class StoryFileObservationTracker {
  private lastObservedHash: string;
  private nextTokenId = 1;
  private readonly pendingInternalWrites = new Map<number, string>();

  constructor(initialHash: string) {
    this.lastObservedHash = initialHash;
  }

  beginInternalWrite(hash: string): InternalStoryWriteToken {
    const token = { id: this.nextTokenId++, hash };
    this.pendingInternalWrites.set(token.id, token.hash);
    return token;
  }

  settleInternalWrite(token: InternalStoryWriteToken, written: boolean): void {
    if (!this.pendingInternalWrites.delete(token.id)) return;
    if (written) this.lastObservedHash = token.hash;
  }

  setObserved(hash: string): void {
    this.lastObservedHash = hash;
  }

  observe(hash: string): StoryFileObservation {
    const changed = this.lastObservedHash !== hash;
    this.lastObservedHash = hash;

    let matchedInternalToken: number | null = null;
    for (const [tokenId, pendingHash] of this.pendingInternalWrites) {
      if (pendingHash === hash) {
        matchedInternalToken = tokenId;
        break;
      }
    }
    if (matchedInternalToken !== null) {
      this.pendingInternalWrites.delete(matchedInternalToken);
    }

    return {
      changed,
      shouldNotify: changed && matchedInternalToken === null,
    };
  }
}
