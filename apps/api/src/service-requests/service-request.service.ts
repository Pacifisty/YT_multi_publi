import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import type { AccountDeletionEmailService } from '../auth/auth.service';
import {
  InMemoryServiceRequestRepository,
  SERVICE_REQUEST_CATEGORIES,
  type ServiceRequestCategory,
  type ServiceRequestRecord,
  type ServiceRequestRepository,
} from './service-request.repository';

export interface CreateServiceRequestDto {
  email: string;
  requesterName?: string;
  category: string;
  subject: string;
  description: string;
}

export interface ServiceRequestServiceOptions {
  repository?: ServiceRequestRepository;
  emailService?: AccountDeletionEmailService;
  env?: Record<string, string | undefined>;
  now?: () => Date;
}

export interface PublicServiceRequest {
  protocol: string;
  category: ServiceRequestCategory;
  subject: string;
  status: ServiceRequestRecord['status'];
  createdAt: string;
  updatedAt: string;
}

export class ServiceRequestError extends Error {
  constructor(readonly status: 400 | 401 | 404, message: string) {
    super(message);
  }
}

export class ServiceRequestService {
  private readonly repository: ServiceRequestRepository;
  private readonly emailService?: AccountDeletionEmailService;
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;

  constructor(options: ServiceRequestServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryServiceRequestRepository();
    this.emailService = options.emailService;
    this.env = options.env ?? process.env;
    this.now = options.now ?? (() => new Date());
  }

  async create(input: Partial<CreateServiceRequestDto> = {}): Promise<{
    request: PublicServiceRequest;
    trackingKey: string;
    trackingUrl: string;
  }> {
    const normalized = validateCreateInput(input);
    const createdAt = this.now();
    const protocol = createProtocol(createdAt);
    const trackingKey = randomBytes(32).toString('base64url');
    const record = await this.repository.create({
      protocol,
      ownerEmail: normalized.email,
      requesterName: normalized.requesterName,
      category: normalized.category,
      subject: normalized.subject,
      description: normalized.description,
      status: 'received',
      trackingTokenHash: hashSecret(trackingKey),
      createdAt,
      updatedAt: createdAt,
    });
    const trackingUrl = buildTrackingUrl(this.env, protocol, trackingKey);

    await this.emailService?.send({
      to: record.ownerEmail,
      subject: `Solicitacao recebida - ${record.protocol}`,
      htmlBody: buildAcknowledgementHtml(record, trackingUrl),
      textBody: buildAcknowledgementText(record, trackingUrl),
    });

    return {
      request: toPublicRequest(record),
      trackingKey,
      trackingUrl,
    };
  }

  async track(protocol: string, trackingKey: string): Promise<PublicServiceRequest> {
    const normalizedProtocol = normalizeProtocol(protocol);
    if (!normalizedProtocol || !trackingKey.trim()) {
      throw new ServiceRequestError(400, 'Informe o protocolo e a chave de acompanhamento.');
    }
    const record = await this.repository.findByProtocol(normalizedProtocol);
    if (!record || !safeHashEquals(record.trackingTokenHash, hashSecret(trackingKey.trim()))) {
      throw new ServiceRequestError(404, 'Solicitacao nao encontrada para os dados informados.');
    }
    return toPublicRequest(record);
  }

  async listForOwner(ownerEmail: string): Promise<PublicServiceRequest[]> {
    const email = normalizeEmail(ownerEmail);
    if (!email) throw new ServiceRequestError(401, 'Unauthorized');
    return (await this.repository.listByOwnerEmail(email)).map(toPublicRequest);
  }

  async getForOwner(ownerEmail: string, protocol: string): Promise<PublicServiceRequest> {
    const email = normalizeEmail(ownerEmail);
    const record = await this.repository.findByProtocol(normalizeProtocol(protocol));
    if (!record || record.ownerEmail !== email) {
      throw new ServiceRequestError(404, 'Solicitacao nao encontrada.');
    }
    return toPublicRequest(record);
  }
}

function validateCreateInput(input: Partial<CreateServiceRequestDto>): {
  email: string;
  requesterName: string | null;
  category: ServiceRequestCategory;
  subject: string;
  description: string;
} {
  const email = normalizeEmail(input.email ?? '');
  const requesterName = String(input.requesterName ?? '').trim();
  const category = String(input.category ?? '').trim().toLowerCase();
  const subject = String(input.subject ?? '').trim();
  const description = String(input.description ?? '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new ServiceRequestError(400, 'Informe um email valido.');
  }
  if (!SERVICE_REQUEST_CATEGORIES.includes(category as ServiceRequestCategory)) {
    throw new ServiceRequestError(400, 'Selecione uma categoria valida.');
  }
  if (requesterName.length > 120) {
    throw new ServiceRequestError(400, 'O nome deve ter no maximo 120 caracteres.');
  }
  if (subject.length < 5 || subject.length > 140) {
    throw new ServiceRequestError(400, 'O assunto deve ter entre 5 e 140 caracteres.');
  }
  if (description.length < 20 || description.length > 4_000) {
    throw new ServiceRequestError(400, 'A descricao deve ter entre 20 e 4000 caracteres.');
  }

  return {
    email,
    requesterName: requesterName || null,
    category: category as ServiceRequestCategory,
    subject,
    description,
  };
}

function createProtocol(now: Date): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const random = randomBytes(6).toString('hex').toUpperCase();
  return `PMP-${date}-${random}`;
}

function buildTrackingUrl(env: Record<string, string | undefined>, protocol: string, trackingKey: string): string {
  const base = env.PUBLIC_APP_URL?.trim() || 'http://127.0.0.1:3000';
  const url = new URL('/login', base);
  url.searchParams.set('protocol', protocol);
  url.searchParams.set('tracking_key', trackingKey);
  url.hash = 'atendimento';
  return url.toString();
}

function toPublicRequest(record: ServiceRequestRecord): PublicServiceRequest {
  return {
    protocol: record.protocol,
    category: record.category,
    subject: record.subject,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function normalizeEmail(value: string): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeProtocol(value: string): string {
  return String(value ?? '').trim().toUpperCase();
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeHashEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildAcknowledgementHtml(record: ServiceRequestRecord, trackingUrl: string): string {
  return `<h1>Solicitacao recebida</h1><p>Recebemos sua solicitacao <strong>${escapeHtml(record.protocol)}</strong>.</p><p>Assunto: ${escapeHtml(record.subject)}</p><p>Status inicial: recebida.</p><p><a href="${escapeHtml(trackingUrl)}">Acompanhar solicitacao</a></p><p>Nao compartilhe o link de acompanhamento.</p>`;
}

function buildAcknowledgementText(record: ServiceRequestRecord, trackingUrl: string): string {
  return `Solicitacao recebida\nProtocolo: ${record.protocol}\nAssunto: ${record.subject}\nStatus: recebida\nAcompanhe em: ${trackingUrl}\nNao compartilhe este link.`;
}
