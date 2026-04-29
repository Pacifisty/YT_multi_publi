/**
 * Email Templates
 *
 * HTML and text email templates for payment and campaign notifications.
 * All templates include action links back to the dashboard.
 */

import type { EmailNotification } from './email-service';

export interface PaymentTemplateData {
  userEmail: string;
  planName: string; // 'BASIC', 'PRO', 'PREMIUM'
  tokensGranted: number;
  totalCost: string; // 'R$ 10.00' or similar formatted
  invoiceUrl?: string;
}

export interface CampaignPublishedTemplateData {
  userEmail: string;
  campaignTitle: string;
  platforms: string[]; // ['YouTube', 'TikTok', 'Instagram']
  destinationCount: number; // number of channels/accounts published
  dashboardUrl: string; // link to view campaign results
}

export interface CampaignFailedTemplateData {
  userEmail: string;
  campaignTitle: string;
  failedCount: number; // number of failed destinations
  suggestedActions: Array<{ action: 'retry' | 'reauth' | 'review'; count: number }>;
  dashboardUrl: string;
}

/**
 * paymentSuccessTemplate: HTML and text for successful payment confirmation
 */
export function paymentSuccessTemplate(data: PaymentTemplateData): {
  subject: string;
  htmlBody: string;
  textBody: string;
} {
  const dashboardUrl = process.env.APP_URL || 'https://app.example.com';

  return {
    subject: `Payment Confirmed - ${data.planName} Plan (${data.tokensGranted} tokens)`,
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4f46e5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
    h1 { margin: 0 0 10px 0; font-size: 24px; }
    .plan-box { background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #4f46e5; margin: 20px 0; }
    .plan-box strong { color: #4f46e5; }
    .cta-button { display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: 600; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Payment Confirmed</h1>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(data.userEmail.split('@')[0])},</p>

      <p>Thank you for your payment! Your account has been upgraded.</p>

      <div class="plan-box">
        <p style="margin: 0 0 10px 0;"><strong>Plan:</strong> ${escapeHtml(data.planName)}</p>
        <p style="margin: 0 0 10px 0;"><strong>Amount Paid:</strong> ${escapeHtml(data.totalCost)}</p>
        <p style="margin: 0;"><strong>Tokens Granted:</strong> ${data.tokensGranted}</p>
      </div>

      <p>You now have <strong>${data.tokensGranted} tokens</strong> to publish videos to YouTube, TikTok, and Instagram.</p>

      <p>Start publishing your content by visiting your dashboard:</p>

      <a href="${dashboardUrl}/dashboard" class="cta-button">View Your Dashboard</a>

      ${data.invoiceUrl ? `<p style="margin-top: 20px;"><a href="${escapeHtml(data.invoiceUrl)}">Download Invoice</a></p>` : ''}

      <div class="footer">
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p>Questions? Contact us at support@example.com</p>
        <p>© 2026 YT Multi-Publisher. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
    textBody: `Payment Confirmed - ${data.planName} Plan

Hi ${data.userEmail.split('@')[0]},

Thank you for your payment! Your account has been upgraded.

Plan: ${data.planName}
Amount Paid: ${data.totalCost}
Tokens Granted: ${data.tokensGranted}

You now have ${data.tokensGranted} tokens to publish videos to YouTube, TikTok, and Instagram.

View your dashboard: ${dashboardUrl}/dashboard

Questions? Contact us at support@example.com
© 2026 YT Multi-Publisher. All rights reserved.
    `.trim(),
  };
}

/**
 * campaignPublishedTemplate: HTML and text for successful campaign publication
 */
export function campaignPublishedTemplate(data: CampaignPublishedTemplateData): {
  subject: string;
  htmlBody: string;
  textBody: string;
} {
  const platformList = data.platforms.join(', ');

  return {
    subject: `✓ Campaign Published: ${data.campaignTitle}`,
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
    h1 { margin: 0 0 10px 0; font-size: 24px; }
    .campaign-box { background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #10b981; margin: 20px 0; }
    .campaign-box strong { color: #10b981; }
    .platform-badge { display: inline-block; background-color: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 4px; margin-right: 8px; margin-bottom: 8px; font-size: 12px; font-weight: 600; }
    .cta-button { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: 600; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Campaign Published!</h1>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(data.userEmail.split('@')[0])},</p>

      <p><strong>${escapeHtml(data.campaignTitle)}</strong> has been successfully published!</p>

      <div class="campaign-box">
        <p style="margin: 0 0 15px 0;"><strong>Campaign:</strong> ${escapeHtml(data.campaignTitle)}</p>
        <p style="margin: 0 0 15px 0;"><strong>Platforms:</strong><br>
        ${data.platforms.map(p => `<span class="platform-badge">${escapeHtml(p)}</span>`).join('\n        ')}
        </p>
        <p style="margin: 0;"><strong>Destinations Published:</strong> ${data.destinationCount}</p>
      </div>

      <p>Your video is now live on ${data.platforms.length === 1 ? data.platforms[0] : `${data.platforms.slice(0, -1).join(', ')}, and ${data.platforms[data.platforms.length - 1]}`}!</p>

      <p>Check out the publishing details and view your campaign analytics:</p>

      <a href="${escapeHtml(data.dashboardUrl)}" class="cta-button">View Campaign Details</a>

      <div class="footer">
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p>Questions? Contact us at support@example.com</p>
        <p>© 2026 YT Multi-Publisher. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
    textBody: `Campaign Published: ${data.campaignTitle}

Hi ${data.userEmail.split('@')[0]},

Your campaign "${data.campaignTitle}" has been successfully published!

Platforms: ${platformList}
Destinations Published: ${data.destinationCount}

Your video is now live on ${platformList}.

View campaign details: ${data.dashboardUrl}

Questions? Contact us at support@example.com
© 2026 YT Multi-Publisher. All rights reserved.
    `.trim(),
  };
}

/**
 * campaignFailedTemplate: HTML and text for campaign publication failure
 */
export function campaignFailedTemplate(data: CampaignFailedTemplateData): {
  subject: string;
  htmlBody: string;
  textBody: string;
} {
  const actionItems = data.suggestedActions
    .map(a => `<li>${a.count} destination(s) need ${escapeHtml(a.action === 'reauth' ? 'reconnection' : a.action)}</li>`)
    .join('\n        ');

  const actionText = data.suggestedActions
    .map(a => `- ${a.count} destination(s) need ${a.action === 'reauth' ? 'reconnection' : a.action}`)
    .join('\n');

  return {
    subject: `⚠ Campaign Failed: ${data.campaignTitle}`,
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
    h1 { margin: 0 0 10px 0; font-size: 24px; }
    .campaign-box { background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #ef4444; margin: 20px 0; }
    .campaign-box strong { color: #ef4444; }
    .action-list { background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .action-list ul { margin: 0; padding-left: 20px; }
    .action-list li { margin: 5px 0; }
    .cta-button { display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: 600; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠ Campaign Publication Failed</h1>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(data.userEmail.split('@')[0])},</p>

      <p>Your campaign <strong>${escapeHtml(data.campaignTitle)}</strong> encountered errors during publication.</p>

      <div class="campaign-box">
        <p style="margin: 0 0 15px 0;"><strong>Campaign:</strong> ${escapeHtml(data.campaignTitle)}</p>
        <p style="margin: 0;"><strong>Failed Destinations:</strong> ${data.failedCount}</p>
      </div>

      <p><strong>Suggested actions:</strong></p>

      <div class="action-list">
        <ul>
        ${actionItems}
        </ul>
      </div>

      <p>Don't worry! You can fix these issues and retry publication from your dashboard. Here are the next steps:</p>

      <ol>
        <li>Visit your dashboard to see what went wrong</li>
        <li>Follow the suggested actions (reconnect accounts, fix validation errors, etc.)</li>
        <li>Retry publishing to the failed destinations</li>
      </ol>

      <a href="${escapeHtml(data.dashboardUrl)}" class="cta-button">View Failed Jobs & Retry</a>

      <div class="footer">
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p>Questions? Contact us at support@example.com</p>
        <p>© 2026 YT Multi-Publisher. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
    textBody: `Campaign Failed: ${data.campaignTitle}

Hi ${data.userEmail.split('@')[0]},

Your campaign "${data.campaignTitle}" encountered errors during publication.

Campaign: ${data.campaignTitle}
Failed Destinations: ${data.failedCount}

Suggested actions:
${actionText}

You can fix these issues and retry publication from your dashboard.

View failed jobs & retry: ${data.dashboardUrl}

Questions? Contact us at support@example.com
© 2026 YT Multi-Publisher. All rights reserved.
    `.trim(),
  };
}

/**
 * buildPaymentEmail: Convert payment template data to EmailNotification
 */
export function buildPaymentEmail(to: string, data: PaymentTemplateData): EmailNotification {
  const { subject, htmlBody, textBody } = paymentSuccessTemplate(data);
  return { to, subject, htmlBody, textBody };
}

/**
 * buildCampaignPublishedEmail: Convert campaign published data to EmailNotification
 */
export function buildCampaignPublishedEmail(
  to: string,
  data: CampaignPublishedTemplateData,
): EmailNotification {
  const { subject, htmlBody, textBody } = campaignPublishedTemplate(data);
  return { to, subject, htmlBody, textBody };
}

/**
 * buildCampaignFailedEmail: Convert campaign failed data to EmailNotification
 */
export function buildCampaignFailedEmail(to: string, data: CampaignFailedTemplateData): EmailNotification {
  const { subject, htmlBody, textBody } = campaignFailedTemplate(data);
  return { to, subject, htmlBody, textBody };
}

/**
 * escapeHtml: Escape user-supplied content to prevent XSS in HTML emails
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}
