import { describe, expect, test, vi } from 'vitest';
import { createDatabaseProvider } from '../../apps/api/src/config/database-provider';

describe('database provider reconnect after queued disconnect', () => {
  test('connect requested after a disconnect is queued during initial startup reconnects after teardown', async () => {
    let resolveInitialConnect: (() => void) | undefined;
    let resolveDisconnect: (() => void) | undefined;
    let markDisconnectStarted: (() => void) | undefined;
    const disconnectStarted = new Promise<void>((resolve) => {
      markDisconnectStarted = resolve;
    });

    const connectFn = vi.fn(() => {
      if (connectFn.mock.calls.length === 1) {
        return new Promise<void>((resolve) => {
          resolveInitialConnect = resolve;
        });
      }

      return Promise.resolve();
    });

    const disconnectFn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDisconnect = resolve;
          markDisconnectStarted?.();
        }),
    );

    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost:5432/test',
      _prismaFactory: () => ({ $connect: connectFn, $disconnect: disconnectFn }),
    });

    const initialConnectPromise = provider.connect();
    const disconnectPromise = provider.disconnect();
    const reconnectPromise = provider.connect();

    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(disconnectFn).toHaveBeenCalledTimes(0);

    resolveInitialConnect?.();
    await disconnectStarted;

    expect(disconnectFn).toHaveBeenCalledTimes(1);

    resolveDisconnect?.();
    await Promise.all([initialConnectPromise, disconnectPromise, reconnectPromise]);

    expect(connectFn).toHaveBeenCalledTimes(2);
    expect(provider.isConnected()).toBe(true);
  });

  test('multiple reconnect calls during a queued disconnect still share one reconnect attempt', async () => {
    let resolveInitialConnect: (() => void) | undefined;
    let resolveDisconnect: (() => void) | undefined;
    let markDisconnectStarted: (() => void) | undefined;
    const disconnectStarted = new Promise<void>((resolve) => {
      markDisconnectStarted = resolve;
    });

    const connectFn = vi.fn(() => {
      if (connectFn.mock.calls.length === 1) {
        return new Promise<void>((resolve) => {
          resolveInitialConnect = resolve;
        });
      }

      return Promise.resolve();
    });

    const disconnectFn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDisconnect = resolve;
          markDisconnectStarted?.();
        }),
    );

    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost:5432/test',
      _prismaFactory: () => ({ $connect: connectFn, $disconnect: disconnectFn }),
    });

    const initialConnectPromise = provider.connect();
    const disconnectPromise = provider.disconnect();
    const reconnectA = provider.connect();
    const reconnectB = provider.connect();

    resolveInitialConnect?.();
    await disconnectStarted;

    expect(disconnectFn).toHaveBeenCalledTimes(1);

    resolveDisconnect?.();
    await Promise.all([initialConnectPromise, disconnectPromise, reconnectA, reconnectB]);

    expect(connectFn).toHaveBeenCalledTimes(2);
    expect(provider.isConnected()).toBe(true);
  });
});
