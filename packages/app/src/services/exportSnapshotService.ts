import type { ExportFormat } from '../stores/uiStore';
import { useUIStore } from '../stores/uiStore';
import {
  prepareStorySnapshot,
  type PrepareStorySnapshotResult,
} from './storyTransactionService';
import type { PreparedStorySnapshot } from './storySnapshot';

let preparedSnapshot: PreparedStorySnapshot | null = null;
const listeners = new Set<() => void>();

function publish(snapshot: PreparedStorySnapshot | null): void {
  preparedSnapshot = snapshot;
  listeners.forEach((listener) => listener());
}

export function subscribePreparedExportSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPreparedExportSnapshot(): PreparedStorySnapshot | null {
  return preparedSnapshot;
}

export function refreshPreparedExportSnapshot(): PrepareStorySnapshotResult {
  const result = prepareStorySnapshot('export');
  if (result.ok) publish(result.snapshot);
  return result;
}

export function requestExportDialog(format: ExportFormat = 'json'): boolean {
  const result = refreshPreparedExportSnapshot();
  if (!result.ok) return false;
  useUIStore.getState().openExportDialog(format);
  return true;
}

export function clearPreparedExportSnapshot(): void {
  publish(null);
}
