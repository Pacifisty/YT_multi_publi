/**
 * Email Service Abstraction
 *
 * Pluggable email notification system supporting SendGrid, Mailgun, and Resend.
 * Failures are logged but do not block campaign or payment processing.
 * Mock provider available for development/testing without external credentials.
 */

export interface EmailNotification {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

interface EmailProviderResult {
  messageId: string;
  success: boolean;
  error?: string;
}

/**
 * IEmailProvider: Abstraction for email delivery drivers
 */
interface IEmailProvider {
  send(notification: EmailNotification): Promise<EmailProviderResult>;
}

/**
 * MockEmailProvider: In-memory mock for development and testing
 * Stores sent notifications or logs to console if no storage provided
 */
class MockEmailProvider implements IEmailProvider {
  private storage: EmailNotification[] | null = null;

  constructor(storage?: EmailNotification[]) {
    this.storage = storage ?? null;
  }

  async send(notification: EmailNotification): Promise<EmailProviderResult> {
    if (this.storage) {
      this.storage.push(notification);
    } else {
      console.log('[email] Mock provider - would send:', { to: notification.to, subject: notification.subject });
    }
    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
  }
}

/**
 * SendGridEmailProvider: SendGrid API driver
 *
 * Uses the SendGrid HTTP API directly, without an optional runtime package.
 */
class SendGridEmailProvider implements IEmailProvider {
  private apiKey: string;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com') {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async send(notification: EmailNotification): Promise<EmailProviderResult> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: notification.to }] }],
          from: { email: this.fromAddress },
          subject: notification.subject,
          content: [
            { type: 'text/html', value: notification.htmlBody },
            ...(notification.textBody ? [{ type: 'text/plain', value: notification.textBody }] : []),
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          messageId: 'failed',
          error: `SendGrid API error: ${response.status} ${errorBody}`,
        };
      }

      const messageId = response.headers.get('x-message-id') || 'unknown';
      return { success: true, messageId };
    } catch (error) {
      return {
        success: false,
        messageId: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * MailgunEmailProvider: Mailgun API driver
 *
 * Uses Mailgun API to send emails.
 */
class MailgunEmailProvider implements IEmailProvider {
  private apiKey: string;
  private domain: string;
  private fromAddress: string;

  constructor(apiKey: string, domain?: string, fromAddress?: string) {
    this.apiKey = apiKey;
    this.domain = domain || process.env.MAILGUN_DOMAIN || 'mg.example.com';
    this.fromAddress = fromAddress || process.env.EMAIL_FROM_ADDRESS || `noreply@${this.domain}`;
  }

  async send(notification: EmailNotification): Promise<EmailProviderResult> {
    try {
      const formData = new URLSearchParams();
      formData.append('from', this.fromAddress);
      formData.append('to', notification.to);
      formData.append('subject', notification.subject);
      formData.append('html', notification.htmlBody);
      if (notification.textBody) {
        formData.append('text', notification.textBody);
      }

      const auth = Buffer.from(`api:${this.apiKey}`).toString('base64');
      const response = await fetch(`https://api.mailgun.net/v3/${this.domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          messageId: 'failed',
          error: `Mailgun API error: ${response.status} ${errorBody}`,
        };
      }

      const result = await response.json() as { id?: string };
      return { success: true, messageId: result.id || 'unknown' };
    } catch (error) {
      return {
        success: false,
        messageId: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * ResendEmailProvider: Resend API driver
 *
 * Uses Resend API to send emails.
 */
class ResendEmailProvider implements IEmailProvider {
  private apiKey: string;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com') {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async send(notification: EmailNotification): Promise<EmailProviderResult> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: notification.to,
          subject: notification.subject,
          html: notification.htmlBody,
          text: notification.textBody,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          messageId: 'failed',
          error: `Resend API error: ${response.status} ${errorBody}`,
        };
      }

      const result = await response.json() as { id?: string };
      return { success: true, messageId: result.id || 'unknown' };
    } catch (error) {
      return {
        success: false,
        messageId: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * EmailService: Main facade for sending notifications
 *
 * Wraps provider drivers with consistent error handling and logging.
 * Never throws; failures are logged and fire-and-forget.
 */
export class EmailService {
  private provider: IEmailProvider;
  private logger?: any;

  constructor(options: { provider: IEmailProvider; logger?: any }) {
    this.provider = options.provider;
    this.logger = options.logger;
  }

  async send(notification: EmailNotification): Promise<void> {
    try {
      const result = await this.provider.send(notification);
      if (!result.success) {
        this.logger?.warn('Email send failed', {
          to: notification.to,
          subject: notification.subject,
          error: result.error,
        });
      } else {
        this.logger?.info('Email sent', {
          to: notification.to,
          subject: notification.subject,
          messageId: result.messageId,
        });
      }
    } catch (error) {
      this.logger?.error('Unexpected error sending email', {
        to: notification.to,
        subject: notification.subject,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * selectEmailProvider: Factory function to select provider from environment
 *
 * Reads EMAIL_PROVIDER and EMAIL_PROVIDER_API_KEY environment variables.
 * Falls back to MockEmailProvider if not configured.
 */
export function selectEmailProvider(
  logger?: any,
  env: Record<string, string | undefined> = process.env,
): IEmailProvider {
  const providerType = env.EMAIL_PROVIDER?.trim().toLowerCase();
  const apiKey = env.EMAIL_PROVIDER_API_KEY?.trim();
  const fromAddress = env.EMAIL_FROM_ADDRESS?.trim();
  const isProduction = env.NODE_ENV === 'production';

  if (!providerType) {
    if (isProduction) {
      throw new Error('EMAIL_PROVIDER is required in production; mock email delivery is disabled');
    }
    logger?.info('EMAIL_PROVIDER not set; using MockEmailProvider');
    return new MockEmailProvider();
  }

  if (isProduction && !fromAddress) {
    throw new Error('EMAIL_FROM_ADDRESS is required in production');
  }

  if (providerType === 'sendgrid') {
    if (!apiKey) {
      throw new Error('EMAIL_PROVIDER set to sendgrid but EMAIL_PROVIDER_API_KEY not provided');
    }
    logger?.info('Email provider: SendGrid');
    return new SendGridEmailProvider(apiKey, fromAddress);
  }

  if (providerType === 'mailgun') {
    if (!apiKey) {
      throw new Error('EMAIL_PROVIDER set to mailgun but EMAIL_PROVIDER_API_KEY not provided');
    }
    logger?.info('Email provider: Mailgun');
    const domain = env.MAILGUN_DOMAIN?.trim();
    if (isProduction && !domain) {
      throw new Error('EMAIL_PROVIDER set to mailgun but MAILGUN_DOMAIN not provided');
    }
    return new MailgunEmailProvider(apiKey, domain, fromAddress);
  }

  if (providerType === 'resend') {
    if (!apiKey) {
      throw new Error('EMAIL_PROVIDER set to resend but EMAIL_PROVIDER_API_KEY not provided');
    }
    logger?.info('Email provider: Resend');
    return new ResendEmailProvider(apiKey, fromAddress);
  }

  if (isProduction) {
    throw new Error(`Unsupported EMAIL_PROVIDER in production: ${providerType}`);
  }
  logger?.warn(`Unknown EMAIL_PROVIDER: ${providerType}; using MockEmailProvider`);
  return new MockEmailProvider();
}

// Export for testing
export { MockEmailProvider };
