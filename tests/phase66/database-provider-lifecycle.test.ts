import { describe, expect, test, vi } from 'vitest';
import { createDatabaseProvider } from '../../apps/api/src/config/database-provider';

describe('database provider lifecycle safety', () => {
  test('connect is idempotent and only calls $connect once', async () => {
    const connectFn = vi.fn().mockResolvedValue(undefined);
    const disconnectFn = vi.fn().mockResolvedValue(undefined);

    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost:5432/test',
      _prismaFactory: () => ({ $connect: connectFn, $disconnect: disconnectFn }),
    });

    await provider.connect();
    await provider.connect();

    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(provider.isConnected()).toBe(true);
  });

  test('disconnect is idempotent and only calls $disconnect once', async () => {
    const connectFn = vi.fn().mockResolvedValue(undefined);
    const disconnectFn = vi.fn().mockResolvedValue(undefined);

    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost:5432/test',
      _prismaFactory: () => ({ $connect: connectFn, $disconnect: disconnectFn }),
    });

    await provider.connect();
    await provider.disconnect();
    await provider.disconnect();

    expect(disconnectFn).toHaveBeenCalledTimes(1);
    expect(provider.isConnected()).toBe(false);
  });

  test('failed connect leaves provider disconnected, cleans up Prisma, and makes later disconnect a no-op', async () => {
    const connectFn = vi.fn().mockRejectedValue(new Error('db unavailable'));
    const disconnectFn = vi.fn().mockResolvedValue(undefined);

    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost:5432/test',
      _prismaFactory: () => ({ $connect: connectFn, $disconnect: disconnectFn }),
    });

    await expect(provider.connect()).rejects.toThrow('db unavailable');
    expect(provider.isConnected()).toBe(false);
    expect(disconnectFn).toHaveBeenCalledTimes(1);

    await provider.disconnect();

    expect(disconnectFn).toHaveBeenCalledTimes(1);
  });

  test('concurrent connect calls share the same in-flight connection attempt', async () => {
    let resolveConnect: (() => void) | undefined;
    const connectFn = vi.fn(() => new Promise<void>((resolve) => {
      resolveConnect = resolve;
    }));

    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost:5432/test',
      _prismaFactory: () => ({ $connect: connectFn, $disconnect: vi.fn().mockResolvedValue(undefined) }),
    });

    const first = provider.connect();
    const second = provider.connect();
    resolveConnect?.();

    await Promise.all([first, second]);

    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(provider.isConnected()).toBe(true);
  });
});
