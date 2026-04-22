import { randomUUID } from 'node:crypto';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  passwordHash: string | null;
  googleSubject: string | null;
  isActive: boolean;
  planSelectionCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAuthUserDto {
  email: string;
  fullName?: string | null;
  passwordHash?: string | null;
  googleSubject?: string | null;
  isActive?: boolean;
  planSelectionCompleted?: boolean;
}

export interface AuthUserRepository {
  create(dto: CreateAuthUserDto): Promise<AuthUser>;
  findById(id: string): Promise<AuthUser | null>;
  findByEmail(email: string): Promise<AuthUser | null>;
  findByGoogleSubject(googleSubject: string): Promise<AuthUser | null>;
  update(id: string, data: Partial<AuthUser>): Promise<AuthUser | null>;
  list(): Promise<AuthUser[]>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeGoogleSubject(googleSubject: string): string {
  return googleSubject.trim();
}

export class InMemoryAuthUserRepository implements AuthUserRepository {
  private readonly records = new Map<string, AuthUser>();

  constructor(seedUsers: AuthUser[] = []) {
    for (const user of seedUsers) {
      this.records.set(user.id, { ...user });
    }
  }

  async create(dto: CreateAuthUserDto): Promise<AuthUser> {
    const now = new Date();
    const user: AuthUser = {
      id: randomUUID(),
      email: normalizeEmail(dto.email),
      fullName: dto.fullName?.trim() || null,
      passwordHash: dto.passwordHash ?? null,
      googleSubject: dto.googleSubject?.trim() || null,
      isActive: dto.isActive ?? true,
      planSelectionCompleted: dto.planSelectionCompleted ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(user.id, user);
    return { ...user };
  }

  async findById(id: string): Promise<AuthUser | null> {
    const user = this.records.get(id);
    return user ? { ...user } : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const normalized = normalizeEmail(email);
    for (const user of this.records.values()) {
      if (normalizeEmail(user.email) === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async findByGoogleSubject(googleSubject: string): Promise<AuthUser | null> {
    const normalized = normalizeGoogleSubject(googleSubject);
    for (const user of this.records.values()) {
      if (user.googleSubject && normalizeGoogleSubject(user.googleSubject) === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async update(id: string, data: Partial<AuthUser>): Promise<AuthUser | null> {
    const existing = this.records.get(id);
    if (!existing) {
      return null;
    }

    const updated: AuthUser = {
      ...existing,
      ...data,
      email: data.email ? normalizeEmail(data.email) : existing.email,
      fullName: data.fullName === undefined ? existing.fullName : data.fullName?.trim() || null,
      googleSubject: data.googleSubject === undefined ? existing.googleSubject : data.googleSubject?.trim() || null,
      updatedAt: data.updatedAt ?? new Date(),
    };
    this.records.set(id, updated);
    return { ...updated };
  }

  async list(): Promise<AuthUser[]> {
    return Array.from(this.records.values()).map((user) => ({ ...user }));
  }
}
