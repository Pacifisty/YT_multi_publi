import { describe, expect, test } from 'vitest';

import { AuthController } from '../src/auth/auth.controller';
import { InMemoryAuthUserRepository } from '../src/auth/auth-user.repository';
import { AuthService } from '../src/auth/auth.service';
import { InMemoryPasswordResetRepository } from '../src/auth/password-reset.repository';
import { createSessionCookieOptions } from '../src/main';
import { InMemoryServiceRequestRepository } from '../src/service-requests/service-request.repository';
import { ServiceRequestService } from '../src/service-requests/service-request.service';

describe('password recovery', () => {
  test('uses a generic response, sends a one-use token and updates the password', async () => {
    const emails: Array<{ to: string; subject: string; textBody?: string }> = [];
    const users = new InMemoryAuthUserRepository([{
      id: 'user-reset-1',
      email: 'creator@example.com',
      fullName: 'Creator',
      passwordHash: 'plain:old-password',
      googleSubject: null,
      isActive: true,
      planSelectionCompleted: true,
      createdAt: new Date('2026-09-04T10:00:00.000Z'),
      updatedAt: new Date('2026-09-04T10:00:00.000Z'),
    }]);
    const service = new AuthService({
      env: { PUBLIC_APP_URL: 'https://pmp.example' },
      userStore: users,
      passwordResetStore: new InMemoryPasswordResetRepository(),
      now: () => new Date('2026-09-04T12:00:00.000Z'),
      emailService: { async send(notification) { emails.push(notification); } },
    });
    const controller = new AuthController(service, createSessionCookieOptions({ NODE_ENV: 'test' }));

    const unknown = await controller.requestPasswordReset({ body: { email: 'unknown@example.com' }, session: null });
    const requested = await controller.requestPasswordReset({ body: { email: 'creator@example.com' }, session: null });
    expect(unknown.status).toBe(202);
    expect(requested.status).toBe(202);
    expect(unknown.body).toEqual(requested.body);
    expect(emails).toHaveLength(1);

    const resetUrl = emails[0].textBody?.match(/https:\/\/\S+/)?.[0] ?? '';
    const token = new URL(resetUrl).searchParams.get('reset_token') ?? '';
    expect(token.length).toBeGreaterThan(30);

    const reset = await controller.resetPassword({
      body: { token, newPassword: 'new-password-123' },
      session: null,
    });
    expect(reset.status).toBe(200);

    const reused = await controller.resetPassword({
      body: { token, newPassword: 'another-password-123' },
      session: null,
    });
    expect(reused.status).toBe(400);

    const login = await controller.login({
      body: { email: 'creator@example.com', password: 'new-password-123' },
      session: { id: 'session-reset' } as any,
    });
    expect(login.status).toBe(200);
  });
});

describe('service requests with protocol', () => {
  test('creates a protocol and only tracks it with its private key', async () => {
    const emails: Array<{ subject: string }> = [];
    const service = new ServiceRequestService({
      repository: new InMemoryServiceRequestRepository(),
      env: { PUBLIC_APP_URL: 'https://pmp.example' },
      now: () => new Date('2026-09-04T12:00:00.000Z'),
      emailService: { async send(notification) { emails.push(notification); } },
    });

    const created = await service.create({
      email: 'creator@example.com',
      requesterName: 'Creator',
      category: 'technical',
      subject: 'Falha ao publicar campanha',
      description: 'A campanha fica na fila e nao inicia o envio do video.',
    });

    expect(created.request.protocol).toMatch(/^PMP-20260904-[A-F0-9]{12}$/);
    expect(created.trackingKey.length).toBeGreaterThan(30);
    expect(created.trackingUrl).toContain(encodeURIComponent(created.request.protocol));
    expect(emails[0].subject).toContain(created.request.protocol);

    await expect(service.track(created.request.protocol, 'wrong-key')).rejects.toMatchObject({ status: 404 });
    await expect(service.track(created.request.protocol, created.trackingKey)).resolves.toMatchObject({
      protocol: created.request.protocol,
      status: 'received',
    });
    await expect(service.listForOwner('creator@example.com')).resolves.toHaveLength(1);
    await expect(service.listForOwner('other@example.com')).resolves.toHaveLength(0);
  });
});
