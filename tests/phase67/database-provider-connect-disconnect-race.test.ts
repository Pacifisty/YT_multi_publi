import { describe, expect, test, vi } from 'vitest';
import { createDatabaseProvider } from '../../apps/api/src/config/database-provider';

describe('database provider connect/disconnect race safety', () => {
  test('disconnect waits for an in-flight connect and then closes the connection', async () => {
    let resolveConnect: (() => void) | undefined;
    const connectFn = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveConnect = resolve;
      }),
    );
    const disconnectFn = vi.fn().mockResolvedValue(undefined);

    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost:5432/test',
      _prismaFactory: () => ({ $connect: connectFn, $disconnect: disconnectFn }),
    });

    const connectPromise = provider.connect();
    const disconnectPromise = provider.disconnect();

    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(disconnectFn).not.toHaveBeenCalled();

    resolveConnect?.();
    await Promise.all([connectPromise, disconnectPromise]);

    expect(disconnectFn).toHaveBeenCalledTimes(1);
    expect(provider.isConnected()).toBe(false);
  });

  test('disconnect during a failing connect resolves without issuing an extra $disconnect', async () => {
    let rejectConnect: ((error: Error) => void) | undefined;
    const connectFn = vi.fn(
      () => new Promise<void>((_, reject) => {
        rejectConnect = reject;
      }),
    );
    const disconnectFn = vi.fn().mockResolvedValue(undefined);

    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost:5432/test',
      _prismaFactory: () => ({ $connect: connectFn, $disconnect: disconnectFn }),
    });

    const connectPromise = provider.connect();
    const disconnectPromise = provider.disconnect();

    rejectConnect?.(new Error('connect failed'));

    await expect(connectPromise).rejects.toThrow('connect failed');
    await expect(disconnectPromise).resolves.toBeUndefined();
    expect(disconnectFn).toHaveBeenCalledTimes(1);
    expect(provider.isConnected()).toBe(false);
  });
});
