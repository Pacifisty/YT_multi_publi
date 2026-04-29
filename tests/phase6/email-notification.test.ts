import { describe, expect, test, beforeEach } from 'vitest';
import {
  EmailService,
  MockEmailProvider,
  selectEmailProvider,
} from '../../apps/api/src/integrations/email/email-service';
import {
  paymentSuccessTemplate,
  campaignPublishedTemplate,
  campaignFailedTemplate,
  buildPaymentEmail,
  buildCampaignPublishedEmail,
  buildCampaignFailedEmail,
  type PaymentTemplateData,
  type CampaignPublishedTemplateData,
  type CampaignFailedTemplateData,
} from '../../apps/api/src/integrations/email/email-templates';

describe('Email Templates', () => {
  describe('paymentSuccessTemplate', () => {
    test('includes plan name and tokens in subject and body', () => {
      const data: PaymentTemplateData = {
        userEmail: 'user@example.com',
        planName: 'PRO',
        tokensGranted: 500,
        totalCost: 'R$ 50.00',
      };

      const template = paymentSuccessTemplate(data);

      expect(template.subject).toContain('PRO');
      expect(template.subject).toContain('500 tokens');
      expect(template.htmlBody).toContain('500 tokens');
      expect(template.htmlBody).toContain('PRO');
      expect(template.htmlBody).toContain('R$ 50.00');
      expect(template.textBody).toContain('500 tokens');
    });

    test('returns html and text bodies', () => {
      const data: PaymentTemplateData = {
        userEmail: 'user@example.com',
        planName: 'BASIC',
        tokensGranted: 100,
        totalCost: 'R$ 10.00',
      };

      const template = paymentSuccessTemplate(data);

      expect(template.htmlBody).toContain('<!DOCTYPE html>');
      expect(template.htmlBody).toContain('<h1>');
      expect(template.textBody).not.toContain('<');
      expect(template.textBody.length > 0).toBe(true);
    });

    test('includes dashboard link', () => {
      const data: PaymentTemplateData = {
        userEmail: 'user@example.com',
        planName: 'PREMIUM',
        tokensGranted: 1000,
        totalCost: 'R$ 100.00',
      };

      const template = paymentSuccessTemplate(data);

      expect(template.htmlBody).toContain('/dashboard');
    });
  });

  describe('campaignPublishedTemplate', () => {
    test('includes campaign title and platforms in subject and body', () => {
      const data: CampaignPublishedTemplateData = {
        userEmail: 'user@example.com',
        campaignTitle: 'My Awesome Video',
        platforms: ['YouTube', 'TikTok'],
        destinationCount: 2,
        dashboardUrl: 'https://app.example.com/dashboard',
      };

      const template = campaignPublishedTemplate(data);

      expect(template.subject).toContain('My Awesome Video');
      expect(template.htmlBody).toContain('My Awesome Video');
      expect(template.htmlBody).toContain('YouTube');
      expect(template.htmlBody).toContain('TikTok');
      expect(template.htmlBody).toContain('2');
      expect(template.htmlBody).toContain('Destinations Published');
      expect(template.textBody).toContain('My Awesome Video');
    });

    test('handles multiple platforms', () => {
      const data: CampaignPublishedTemplateData = {
        userEmail: 'user@example.com',
        campaignTitle: 'Test Campaign',
        platforms: ['YouTube', 'TikTok', 'Instagram'],
        destinationCount: 3,
        dashboardUrl: 'https://app.example.com/dashboard',
      };

      const template = campaignPublishedTemplate(data);

      expect(template.htmlBody).toContain('YouTube');
      expect(template.htmlBody).toContain('TikTok');
      expect(template.htmlBody).toContain('Instagram');
    });

    test('includes dashboard link in campaign emails', () => {
      const data: CampaignPublishedTemplateData = {
        userEmail: 'user@example.com',
        campaignTitle: 'Test',
        platforms: ['YouTube'],
        destinationCount: 1,
        dashboardUrl: 'https://app.example.com/dashboard',
      };

      const template = campaignPublishedTemplate(data);

      expect(template.htmlBody).toContain('https://app.example.com/dashboard');
    });
  });

  describe('campaignFailedTemplate', () => {
    test('includes campaign title and failed count', () => {
      const data: CampaignFailedTemplateData = {
        userEmail: 'user@example.com',
        campaignTitle: 'Failed Campaign',
        failedCount: 2,
        suggestedActions: [{ action: 'retry', count: 2 }],
        dashboardUrl: 'https://app.example.com/dashboard',
      };

      const template = campaignFailedTemplate(data);

      expect(template.subject).toContain('Failed Campaign');
      expect(template.htmlBody).toContain('Failed Campaign');
      expect(template.htmlBody).toContain('2 destination');
      expect(template.textBody).toContain('Failed Campaign');
      expect(template.textBody).toContain('2 destination');
    });

    test('lists suggested actions with counts', () => {
      const data: CampaignFailedTemplateData = {
        userEmail: 'user@example.com',
        campaignTitle: 'Test',
        failedCount: 3,
        suggestedActions: [
          { action: 'retry', count: 1 },
          { action: 'reauth', count: 1 },
          { action: 'review', count: 1 },
        ],
        dashboardUrl: 'https://app.example.com/dashboard',
      };

      const template = campaignFailedTemplate(data);

      expect(template.htmlBody).toContain('retry');
      expect(template.htmlBody).toContain('reconnection');
      expect(template.htmlBody).toContain('review');
    });

    test('includes dashboard link for failed emails', () => {
      const data: CampaignFailedTemplateData = {
        userEmail: 'user@example.com',
        campaignTitle: 'Test',
        failedCount: 1,
        suggestedActions: [{ action: 'review', count: 1 }],
        dashboardUrl: 'https://app.example.com/dashboard',
      };

      const template = campaignFailedTemplate(data);

      expect(template.htmlBody).toContain('https://app.example.com/dashboard');
    });
  });

  describe('Email builder functions', () => {
    test('buildPaymentEmail creates proper EmailNotification', () => {
      const data: PaymentTemplateData = {
        userEmail: 'test@example.com',
        planName: 'PRO',
        tokensGranted: 500,
        totalCost: 'R$ 50.00',
      };

      const email = buildPaymentEmail('test@example.com', data);

      expect(email.to).toBe('test@example.com');
      expect(email.subject).toContain('PRO');
      expect(email.htmlBody).toBeTruthy();
      expect(email.textBody).toBeTruthy();
    });

    test('buildCampaignPublishedEmail creates proper EmailNotification', () => {
      const data: CampaignPublishedTemplateData = {
        userEmail: 'test@example.com',
        campaignTitle: 'Test',
        platforms: ['YouTube'],
        destinationCount: 1,
        dashboardUrl: 'https://app.example.com/dashboard',
      };

      const email = buildCampaignPublishedEmail('test@example.com', data);

      expect(email.to).toBe('test@example.com');
      expect(email.subject).toContain('Published');
      expect(email.htmlBody).toBeTruthy();
      expect(email.textBody).toBeTruthy();
    });

    test('buildCampaignFailedEmail creates proper EmailNotification', () => {
      const data: CampaignFailedTemplateData = {
        userEmail: 'test@example.com',
        campaignTitle: 'Test',
        failedCount: 1,
        suggestedActions: [{ action: 'retry', count: 1 }],
        dashboardUrl: 'https://app.example.com/dashboard',
      };

      const email = buildCampaignFailedEmail('test@example.com', data);

      expect(email.to).toBe('test@example.com');
      expect(email.subject).toContain('Failed');
      expect(email.htmlBody).toBeTruthy();
      expect(email.textBody).toBeTruthy();
    });
  });
});

describe('EmailService', () => {
  describe('MockEmailProvider', () => {
    test('stores notifications in provided array', async () => {
      const storage: any[] = [];
      const provider = new MockEmailProvider(storage);

      await provider.send({
        to: 'test@example.com',
        subject: 'Test',
        htmlBody: '<p>Test</p>',
      });

      expect(storage).toHaveLength(1);
      expect(storage[0].to).toBe('test@example.com');
      expect(storage[0].subject).toBe('Test');
    });

    test('returns success result', async () => {
      const provider = new MockEmailProvider();

      const result = await provider.send({
        to: 'test@example.com',
        subject: 'Test',
        htmlBody: '<p>Test</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeTruthy();
      expect(result.error).toBeUndefined();
    });
  });

  describe('selectEmailProvider', () => {
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('returns MockEmailProvider when EMAIL_PROVIDER not set', () => {
      delete process.env.EMAIL_PROVIDER;

      const provider = selectEmailProvider();

      expect(provider).toBeInstanceOf(MockEmailProvider);
    });

    test('returns SendGridEmailProvider when EMAIL_PROVIDER=sendgrid', () => {
      process.env.EMAIL_PROVIDER = 'sendgrid';
      process.env.EMAIL_PROVIDER_API_KEY = 'test-key';

      const provider = selectEmailProvider();

      // Check that it's not MockEmailProvider
      expect(provider).not.toBeInstanceOf(MockEmailProvider);
    });

    test('throws error when SendGrid provider requested but no API key', () => {
      process.env.EMAIL_PROVIDER = 'sendgrid';
      delete process.env.EMAIL_PROVIDER_API_KEY;

      expect(() => selectEmailProvider()).toThrow('EMAIL_PROVIDER_API_KEY');
    });

    test('returns MailgunEmailProvider when EMAIL_PROVIDER=mailgun', () => {
      process.env.EMAIL_PROVIDER = 'mailgun';
      process.env.EMAIL_PROVIDER_API_KEY = 'test-key';

      const provider = selectEmailProvider();

      expect(provider).not.toBeInstanceOf(MockEmailProvider);
    });

    test('returns ResendEmailProvider when EMAIL_PROVIDER=resend', () => {
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.EMAIL_PROVIDER_API_KEY = 'test-key';

      const provider = selectEmailProvider();

      expect(provider).not.toBeInstanceOf(MockEmailProvider);
    });

    test('returns MockEmailProvider for unknown provider type', () => {
      process.env.EMAIL_PROVIDER = 'unknown_provider';

      const provider = selectEmailProvider();

      expect(provider).toBeInstanceOf(MockEmailProvider);
    });
  });

  describe('EmailService.send', () => {
    test('sends notification without throwing', async () => {
      const storage: any[] = [];
      const mockProvider = new MockEmailProvider(storage);
      const emailService = new EmailService({ provider: mockProvider });

      const notification = {
        to: 'test@example.com',
        subject: 'Test',
        htmlBody: '<p>Test</p>',
      };

      await expect(emailService.send(notification)).resolves.not.toThrow();
      expect(storage).toHaveLength(1);
    });

    test('logs when email is sent successfully', async () => {
      const logs: any[] = [];
      const mockProvider = new MockEmailProvider();
      const logger = {
        info: (...args: any[]) => logs.push({ level: 'info', args }),
      };
      const emailService = new EmailService({ provider: mockProvider, logger });

      await emailService.send({
        to: 'test@example.com',
        subject: 'Test',
        htmlBody: '<p>Test</p>',
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
    });

    test('logs failures without throwing', async () => {
      const logs: any[] = [];
      const failingProvider = {
        send: async () => ({
          success: false,
          messageId: 'failed',
          error: 'Test error',
        }),
      };
      const logger = {
        warn: (...args: any[]) => logs.push({ level: 'warn', args }),
      };
      const emailService = new EmailService({ provider: failingProvider as any, logger });

      await expect(emailService.send({
        to: 'test@example.com',
        subject: 'Test',
        htmlBody: '<p>Test</p>',
      })).resolves.not.toThrow();

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
    });
  });
});

// Helper to reset process.env after tests
function afterEach() {
  // Reset function will be provided by test framework
}
