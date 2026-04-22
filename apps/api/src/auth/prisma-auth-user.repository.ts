import type { AuthUser, AuthUserRepository, CreateAuthUserDto } from './auth-user.repository';

interface PrismaClient {
  adminUser: {
    create(args: { data: any }): Promise<any>;
    findUnique(args: { where: { id?: string; email?: string; googleSubject?: string } }): Promise<any>;
    findMany(): Promise<any[]>;
    update(args: { where: { id: string }; data: any }): Promise<any>;
  };
}

function toAuthUser(row: any): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName ?? null,
    passwordHash: row.passwordHash ?? null,
    googleSubject: row.googleSubject ?? null,
    isActive: Boolean(row.isActive),
    planSelectionCompleted: Boolean(row.planSelectionCompleted),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}

export class PrismaAuthUserRepository implements AuthUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(dto: CreateAuthUserDto): Promise<AuthUser> {
    const row = await this.prisma.adminUser.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        fullName: dto.fullName?.trim() || null,
        passwordHash: dto.passwordHash ?? null,
        googleSubject: dto.googleSubject?.trim() || null,
        isActive: dto.isActive ?? true,
        planSelectionCompleted: dto.planSelectionCompleted ?? false,
      },
    });
    return toAuthUser(row);
  }

  async findById(id: string): Promise<AuthUser | null> {
    const row = await this.prisma.adminUser.findUnique({ where: { id } });
    return row ? toAuthUser(row) : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const row = await this.prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return row ? toAuthUser(row) : null;
  }

  async findByGoogleSubject(googleSubject: string): Promise<AuthUser | null> {
    const row = await this.prisma.adminUser.findUnique({
      where: { googleSubject: googleSubject.trim() },
    });
    return row ? toAuthUser(row) : null;
  }

  async update(id: string, data: Partial<AuthUser>): Promise<AuthUser | null> {
    try {
      const row = await this.prisma.adminUser.update({
        where: { id },
        data: {
          ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
          ...(data.fullName !== undefined ? { fullName: data.fullName?.trim() || null } : {}),
          ...(data.passwordHash !== undefined ? { passwordHash: data.passwordHash } : {}),
          ...(data.googleSubject !== undefined ? { googleSubject: data.googleSubject?.trim() || null } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.planSelectionCompleted !== undefined ? { planSelectionCompleted: data.planSelectionCompleted } : {}),
          ...(data.updatedAt !== undefined ? { updatedAt: data.updatedAt } : {}),
        },
      });
      return toAuthUser(row);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  async list(): Promise<AuthUser[]> {
    const rows = await this.prisma.adminUser.findMany();
    return rows.map(toAuthUser);
  }
}
