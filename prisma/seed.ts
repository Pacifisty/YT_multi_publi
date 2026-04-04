export interface SeedEnv {
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD_HASH?: string;
}

export interface SeedAdminUser {
  email: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
}

export function getSeedAdminUser(env: SeedEnv = process.env): SeedAdminUser {
  const email = env.ADMIN_EMAIL?.trim();
  const passwordHash = env.ADMIN_PASSWORD_HASH?.trim();

  if (!email) {
    throw new Error('ADMIN_EMAIL must be configured for the seeded admin user.');
  }

  if (!passwordHash) {
    throw new Error('ADMIN_PASSWORD_HASH must be configured for the seeded admin user.');
  }

  return {
    email,
    passwordHash,
    isActive: true,
    createdAt: new Date(0).toISOString(),
  };
}

export function seedAdminUsers(env: SeedEnv = process.env): SeedAdminUser[] {
  return [getSeedAdminUser(env)];
}
