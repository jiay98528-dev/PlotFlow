const GRAPH_HISTORY_LIMIT = 100;

export interface GraphHistoryEntry {
  readonly beforeContent: string;
  readonly afterContent: string;
  readonly beforeSelectedNodeId: string | null;
  readonly afterSelectedNodeId: string | null;
  readonly beforeActiveChapterId: string | null;
  readonly afterActiveChapterId: string | null;
  readonly source: string;
}

export interface GraphHistoryReplayTarget {
  readonly content: string;
  readonly selectedNodeId: string | null;
  readonly activeChapterId: string | null;
}

export interface GraphHistoryReplayContext {
  readonly direction: 'undo' | 'redo';
  readonly entry: GraphHistoryEntry;
  readonly source: string;
}

export type GraphHistoryReplayHandler = (
  target: GraphHistoryReplayTarget,
  context: GraphHistoryReplayContext,
) => void | Promise<void>;

export interface GraphHistoryState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoDepth: number;
  readonly redoDepth: number;
  readonly isReplaying: boolean;
}

export type GraphHistoryListener = (state: GraphHistoryState) => void;

const undoStack: GraphHistoryEntry[] = [];
const redoStack: GraphHistoryEntry[] = [];
const listeners = new Set<GraphHistoryListener>();

let replayHandler: GraphHistoryReplayHandler | null = null;
let isReplaying = false;

function createReplayTarget(
  entry: GraphHistoryEntry,
  direction: 'undo' | 'redo',
): GraphHistoryReplayTarget {
  if (direction === 'undo') {
    return {
      content: entry.beforeContent,
      selectedNodeId: entry.beforeSelectedNodeId,
      activeChapterId: entry.beforeActiveChapterId,
    };
  }

  return {
    content: entry.afterContent,
    selectedNodeId: entry.afterSelectedNodeId,
    activeChapterId: entry.afterActiveChapterId,
  };
}

function isNoop(entry: GraphHistoryEntry): boolean {
  return (
    entry.beforeContent === entry.afterContent &&
    entry.beforeSelectedNodeId === entry.afterSelectedNodeId &&
    entry.beforeActiveChapterId === entry.afterActiveChapterId
  );
}

function emitState(): void {
  const state = getGraphHistoryState();
  listeners.forEach((listener) => listener(state));
}

async function replay(direction: 'undo' | 'redo'): Promise<boolean> {
  if (isReplaying || replayHandler === null) return false;

  const sourceStack = direction === 'undo' ? undoStack : redoStack;
  const destinationStack = direction === 'undo' ? redoStack : undoStack;
  const entry = sourceStack[sourceStack.length - 1];
  if (!entry) return false;

  isReplaying = true;
  emitState();

  try {
    await replayHandler(createReplayTarget(entry, direction), {
      direction,
      entry,
      source: entry.source,
    });

    // A session reset may clear the history while an asynchronous replay is
    // pending. In that case, never transplant the stale entry into the new
    // session's opposite stack.
    if (sourceStack[sourceStack.length - 1] === entry) {
      sourceStack.pop();
      destinationStack.push(entry);
    }
    return true;
  } finally {
    isReplaying = false;
    emitState();
  }
}

export function configureGraphHistoryReplay(
  handler: GraphHistoryReplayHandler | null,
): () => void {
  replayHandler = handler;
  return () => {
    if (replayHandler === handler) {
      replayHandler = null;
    }
  };
}

export function recordGraphEdit(entry: GraphHistoryEntry): boolean {
  if (isReplaying || isNoop(entry)) return false;

  undoStack.push({ ...entry });
  if (undoStack.length > GRAPH_HISTORY_LIMIT) {
    undoStack.splice(0, undoStack.length - GRAPH_HISTORY_LIMIT);
  }
  redoStack.length = 0;
  emitState();
  return true;
}

export function undoGraphEdit(): Promise<boolean> {
  return replay('undo');
}

export function redoGraphEdit(): Promise<boolean> {
  return replay('redo');
}

export function canUndo(): boolean {
  return !isReplaying && undoStack.length > 0;
}

export function canRedo(): boolean {
  return !isReplaying && redoStack.length > 0;
}

export function clearGraphHistory(): void {
  undoStack.length = 0;
  redoStack.length = 0;
  emitState();
}

export function invalidateGraphRedo(): void {
  if (redoStack.length === 0) return;
  redoStack.length = 0;
  emitState();
}

export function getGraphHistoryState(): GraphHistoryState {
  return {
    canUndo: canUndo(),
    canRedo: canRedo(),
    undoDepth: undoStack.length,
    redoDepth: redoStack.length,
    isReplaying,
  };
}

export function subscribeGraphHistory(listener: GraphHistoryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
