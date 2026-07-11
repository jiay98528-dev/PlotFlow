import { describe, expect, expectTypeOf, it } from 'vitest';
import { IPC_CHANNELS, type IpcChannel, type MenuEventChannel } from '../src/shared/ipcChannels';

function collectChannels(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(collectChannels);
}

describe('IPC channel contract', () => {
  it('contains unique channel names', () => {
    const channels = collectChannels(IPC_CHANNELS);
    expect(new Set(channels).size).toBe(channels.length);
  });

  it('derives channel unions from the shared constants', () => {
    expectTypeOf(IPC_CHANNELS.file.open).toMatchTypeOf<IpcChannel>();
    expectTypeOf(IPC_CHANNELS.menu.events.fileOpen).toMatchTypeOf<MenuEventChannel>();
  });
});

