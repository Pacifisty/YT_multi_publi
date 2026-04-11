import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

describe('prisma migration artifacts', () => {
  function getMigrationSqlPaths() {
    const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
    return readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(migrationsDir, entry.name, 'migration.sql'))
      .filter((path) => existsSync(path));
  }

  test('includes a migration for publish_jobs campaign_target_id uniqueness', () => {
    const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
    const lockPath = join(migrationsDir, 'migration_lock.toml');

    expect(existsSync(migrationsDir)).toBe(true);
    expect(existsSync(lockPath)).toBe(true);
    expect(readFileSync(lockPath, 'utf8')).toContain('provider = "postgresql"');

    const migrationSqlPaths = getMigrationSqlPaths();

    const uniquePublishJobMigration = migrationSqlPaths.find((path) => {
      const sql = readFileSync(path, 'utf8');
      return sql.includes('"publish_jobs"')
        && sql.includes('"campaign_target_id"')
        && sql.toUpperCase().includes('UNIQUE');
    });

    expect(uniquePublishJobMigration).toBeDefined();
  });

  test('includes a migration that creates the audit_events table', () => {
    const migrationSqlPaths = getMigrationSqlPaths();

    const auditEventsMigration = migrationSqlPaths.find((path) => {
      const sql = readFileSync(path, 'utf8').toLowerCase();
      return sql.includes('audit_events')
        && sql.includes('create table');
    });

    expect(auditEventsMigration).toBeDefined();
  });
});
