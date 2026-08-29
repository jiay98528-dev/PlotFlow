import type { FileExternalChangeEvent } from '../types/electron';

export interface ExternalChangeLease {
  readonly storySessionId: number;
  readonly filePath: string | null;
}

interface ExternalChangeTicket {
  readonly version: number;
  readonly event: FileExternalChangeEvent;
  readonly lease: ExternalChangeLease;
  readonly needsConfirmation: boolean;
}

export interface ExternalChangeCoordinatorDependencies {
  readonly getLease: () => ExternalChangeLease;
  readonly hasUnsavedChanges: () => boolean;
  readonly isCurrentFile: (filePath: string) => boolean;
  readonly setPending: (event: FileExternalChangeEvent) => void;
  readonly confirm: (event: FileExternalChangeEvent) => Promise<number>;
  readonly reload: (event: FileExternalChangeEvent) => Promise<void>;
  readonly overwrite: (event: FileExternalChangeEvent) => Promise<void>;
  readonly saveCopy: () => Promise<void>;
  readonly showPending: () => void;
}

function sameLease(left: ExternalChangeLease, right: ExternalChangeLease): boolean {
  return left.storySessionId === right.storySessionId && left.filePath === right.filePath;
}

/**
 * Coalesces a burst of disk notifications without adding any new user gate.
 * While the existing confirmation is open, a newer notification only replaces
 * the pending payload. The current choice then consumes that latest payload
 * where doing so is safe (Reload), or leaves it pending (stale Overwrite).
 */
export function createLatestOnlyExternalChangeCoordinator(
  dependencies: ExternalChangeCoordinatorDependencies,
): {
  readonly enqueue: (event: FileExternalChangeEvent) => Promise<void>;
  readonly dispose: () => void;
} {
  let nextVersion = 0;
  let processedVersion = 0;
  let latest: ExternalChangeTicket | null = null;
  let activeDrain: Promise<void> | null = null;
  let disposed = false;

  const isTicketLeaseCurrent = (ticket: ExternalChangeTicket): boolean =>
    sameLease(ticket.lease, dependencies.getLease());

  const processTicket = async (ticket: ExternalChangeTicket): Promise<number> => {
    if (!isTicketLeaseCurrent(ticket)) return ticket.version;

    if (!ticket.needsConfirmation) {
      await dependencies.reload(ticket.event);
      return ticket.version;
    }

    const choice = await dependencies.confirm(ticket.event);
    if (disposed) return latest?.version ?? ticket.version;

    const decisionTicket = latest && latest.version >= ticket.version ? latest : ticket;
    if (!isTicketLeaseCurrent(decisionTicket)) {
      dependencies.showPending();
      return decisionTicket.version;
    }

    if (choice === 0) {
      await dependencies.saveCopy();
    } else if (choice === 1) {
      await dependencies.reload(decisionTicket.event);
    } else if (choice === 2) {
      if (decisionTicket.version === ticket.version) {
        await dependencies.overwrite(ticket.event);
      } else {
        dependencies.showPending();
      }
    } else {
      dependencies.showPending();
    }
    return decisionTicket.version;
  };

  const drain = async (): Promise<void> => {
    while (!disposed && latest && latest.version > processedVersion) {
      const ticket = latest;
      const consumedVersion = await processTicket(ticket);
      processedVersion = Math.max(processedVersion, consumedVersion);
    }
  };

  const startDrain = (): Promise<void> => {
    if (activeDrain) return activeDrain;
    activeDrain = drain().finally(() => {
      activeDrain = null;
      if (!disposed && latest && latest.version > processedVersion) {
        void startDrain();
      }
    });
    return activeDrain;
  };

  return {
    enqueue(event): Promise<void> {
      if (disposed || !dependencies.isCurrentFile(event.filePath)) return Promise.resolve();

      const ticket: ExternalChangeTicket = {
        version: ++nextVersion,
        event,
        lease: dependencies.getLease(),
        needsConfirmation: dependencies.hasUnsavedChanges(),
      };
      latest = ticket;
      if (ticket.needsConfirmation) dependencies.setPending(event);

      return startDrain();
    },

    dispose(): void {
      disposed = true;
    },
  };
}
