export type LegalDocumentKey = 'privacy' | 'terms' | 'data-deletion';

export interface LegalDocumentSection {
  heading: string;
  html: string;
}

export interface LegalDocument {
  key: LegalDocumentKey;
  title: string;
  ptTitle: string;
  subtitle: string;
  lastUpdated: string;
  reviewNote: string;
  sections: LegalDocumentSection[];
}

export const LEGAL_CONTACT_EMAIL = 'PlataformMultiPublisher@gmail.com';
export const LEGAL_LAST_UPDATED = 'May 2, 2026';
export const LEGAL_REVIEW_NOTE = 'This document should be reviewed by a qualified legal professional before publishing or relying on it for platform approval.';
export const LEGAL_TRANSPARENCY_NOTICE =
  'Platform Multi Publisher is not owned by, endorsed by, sponsored by, or officially operated by TikTok, YouTube, Google, Instagram, Meta, or any of their affiliates.';

export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
  privacy: {
    key: 'privacy',
    title: 'Politica de Privacidade',
    ptTitle: 'Politica de Privacidade',
    subtitle: 'How Platform Multi Publisher handles account, media, campaign and platform API data for YouTube, TikTok and Instagram integrations.',
    lastUpdated: LEGAL_LAST_UPDATED,
    reviewNote: LEGAL_REVIEW_NOTE,
    sections: [
      {
        heading: 'Introduction',
        html: `<p>This Privacy Policy explains how Platform Multi Publisher ("Platform Multi Publisher", "we", "us", or "our") collects, uses, stores, shares, and protects information when users access our web application and connect YouTube, TikTok, or Instagram accounts for multi-platform video publishing.</p><p>${LEGAL_TRANSPARENCY_NOTICE}</p>`,
      },
      {
        heading: 'Who we are',
        html: `<ul><li>App name: Platform Multi Publisher.</li><li>Company/developer name: Lucas Domingues.</li><li>Website URL: https://www.plataformmultipublisher.com.</li><li>Contact email: ${LEGAL_CONTACT_EMAIL}.</li><li>Business address: Alameda dos Mutuns.</li><li>Target users/countries: Brazil.</li><li>Platform: Web application.</li></ul>`,
      },
      {
        heading: 'Scope of this Privacy Policy',
        html: '<p>This Privacy Policy applies to our website, workspace, account connection flows, campaign tools, media library, scheduling features, and publishing features. It also applies to data we receive through official APIs when a user authorizes Platform Multi Publisher to access a YouTube, TikTok, or Instagram account.</p><p>Third-party platforms have their own privacy policies and terms. Your use of TikTok, YouTube, Google, Instagram, and Meta services remains subject to those third-party policies.</p>',
      },
      {
        heading: 'Information we collect',
        html: '<p>We collect only information needed to operate the workspace, authenticate users, manage campaigns, process publishing jobs, and provide support.</p><ul><li>Account information, such as name, email address, password hash if email/password login is used, Google login identifiers, plan selection, account status, and session information.</li><li>Connected account information, such as provider name, provider account identifier, display name, email when provided by the provider, authorization scopes, token expiry time, connection status, and encrypted access or refresh tokens.</li><li>Campaign and publishing information, such as campaign title, selected video, destination account, channel, caption, title, description, tags, thumbnails, privacy settings, playlist settings, scheduled time, post status, error messages, retry count, and external publish identifiers.</li><li>Media information, such as uploaded video and thumbnail files, original file names, MIME types, file sizes, storage paths, duration, and linked campaign records.</li><li>Usage and technical information, such as cookies, session data, request logs, IP address, browser information, device information, error logs, audit events, and security events.</li><li>Payment and plan information, such as selected plan, token balance, billing dates, payment intent references, webhook event records, and payment status. Full payment card details should be handled by the payment processor, not by Platform Multi Publisher.</li></ul>',
      },
      {
        heading: 'TikTok data we collect through TikTok APIs',
        html: '<p>When you connect TikTok, we request the following scopes because the app needs them for the stated publishing workflow: <code>user.info.basic</code>, <code>video.publish</code>, and <code>video.upload</code>. In sandbox mode, the app may request only <code>user.info.basic</code>.</p><ul><li><code>user.info.basic</code>: used to identify the connected TikTok account and show the user which TikTok account is connected. We may receive TikTok open ID, display name, and avatar URL.</li><li><code>video.upload</code>: used to prepare or upload video content selected by the user for TikTok publishing.</li><li><code>video.publish</code>: used to publish a video to the connected TikTok account when the user creates or launches a campaign.</li></ul><p>We also store the TikTok authorization scopes granted, encrypted access token, encrypted refresh token if provided, token expiry, selected TikTok privacy level, selected interaction controls, publish job status, external publish ID, and TikTok API error information needed to show status or request reconnection.</p>',
      },
      {
        heading: 'YouTube and Instagram data we collect through official APIs',
        html: '<p>For YouTube, the app uses Google OAuth and YouTube Data API scopes: <code>openid</code>, <code>email</code>, <code>profile</code>, <code>https://www.googleapis.com/auth/youtube.readonly</code>, <code>https://www.googleapis.com/auth/youtube.upload</code>, and <code>https://www.googleapis.com/auth/youtube.force-ssl</code>. We use these to authenticate the user, show available YouTube channels, upload user-selected videos, apply metadata, and manage authorized publishing actions.</p><p>Platform Multi Publisher\'s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.</p><p>For Instagram, the app uses Meta OAuth scopes <code>instagram_business_basic</code> and <code>instagram_business_content_publish</code>. We use these to identify the connected Instagram Business or Creator account and publish user-selected Reels with captions and feed-sharing settings.</p>',
      },
      {
        heading: 'Why we collect and use this information',
        html: '<ul><li>To create, authenticate, and secure user accounts and sessions.</li><li>To connect user-authorized YouTube, TikTok, and Instagram accounts through OAuth.</li><li>To show connected destinations, channels, privacy options, and account health.</li><li>To store user-created campaigns, media, captions, metadata, schedules, and publishing preferences.</li><li>To publish videos only to destinations selected by the user.</li><li>To track publishing status, retries, API errors, and reauthorization requirements.</li><li>To provide customer support, security monitoring, abuse prevention, billing, and operational logs.</li><li>To comply with applicable law, platform rules, and valid legal requests.</li></ul>',
      },
      {
        heading: 'Legal basis for processing, if applicable',
        html: '<p>Where privacy laws require a legal basis, we process personal data based on user consent and OAuth authorization, performance of our contract with the user, legitimate interests in operating and securing the service, compliance with legal obligations, and user instructions to publish content to selected platforms.</p>',
      },
      {
        heading: 'How we use TikTok data',
        html: '<p>We use TikTok data only to provide the TikTok-related features selected by the user: connecting a TikTok account, displaying the connected account, preparing campaign destinations, applying user-selected privacy and interaction settings, publishing user-selected videos, polling publish status, showing errors, and refreshing or invalidating tokens when required.</p>',
      },
      {
        heading: 'What we do not do with TikTok data',
        html: '<ul><li>We do not sell TikTok data.</li><li>We do not rent TikTok data.</li><li>We do not use TikTok data to build advertising profiles or target ads.</li><li>We do not share TikTok data with third parties except service providers needed to operate the app, or when required by law.</li><li>We do not claim that Platform Multi Publisher is owned, endorsed, sponsored, or officially operated by TikTok.</li><li>We do not publish to TikTok unless the user has connected an account and selected or launched a campaign that requires TikTok publishing.</li></ul>',
      },
      {
        heading: 'Data sharing and service providers',
        html: '<p>We may share data with vendors that help us operate the service, such as hosting providers, database providers, object storage providers, payment processors, analytics providers, email providers, logging/security tools, customer support tools, and professional advisors. Current service providers include Cloudflare, Mercado Pago, Google/YouTube, TikTok, and Meta/Instagram.</p><p>We may send user-selected content and metadata to YouTube, TikTok, Instagram, Google, or Meta only as needed to complete the publishing actions authorized by the user. We may disclose information if required by law, to protect rights and safety, or to enforce our Terms of Service.</p>',
      },
      {
        heading: 'Cookies and analytics',
        html: '<p>We use necessary cookies and similar technologies for login sessions, locale preferences, security, and workspace functionality. Analytics providers: None.</p>',
      },
      {
        heading: 'Data retention',
        html: '<p>We retain account, connected account, campaign, media, audit, and billing records for as long as needed to provide the service, comply with legal obligations, resolve disputes, prevent abuse, and maintain operational logs. Specific retention period: 90 days after a deletion request, unless longer retention is required by law, security, fraud prevention, financial recordkeeping, or unresolved campaign dependencies.</p><p>When a user disconnects a platform account, we mark the account as disconnected and stop using its token for publishing. When a user permanently deletes a connected account or requests deletion, we delete or anonymize applicable records unless retention is required by law, security, fraud prevention, backup recovery, or unresolved campaign dependencies.</p>',
      },
      {
        heading: 'Data security',
        html: '<p>We use security measures designed to protect data, including HTTPS for public access where configured, encrypted storage of OAuth access and refresh tokens, session protections, access controls, limited administrative access, audit logs, rate limiting, and operational monitoring. No online service can guarantee absolute security.</p><p>Data is stored in the application\'s configured database and media storage. Hosting/storage provider: Cloudflare.</p>',
      },
      {
        heading: 'User choices and rights',
        html: '<p>Depending on where you live, you may have rights to access, correct, delete, restrict, object to, or export your personal data. You may also withdraw authorization for connected platform accounts. We will respond to valid requests as required by applicable law.</p>',
      },
      {
        heading: 'How users can disconnect TikTok or revoke access',
        html: '<p>Inside Platform Multi Publisher, users can go to the workspace accounts area, choose the connected TikTok account, and disconnect or permanently delete it where available. This stops the app from using that account for future campaigns.</p><p>Users can also revoke access directly from TikTok account settings under connected or authorized apps. For YouTube/Google, users can revoke access from their Google Account security settings under third-party apps and services. For Instagram/Meta, users can revoke access from Instagram or Meta account settings under apps, websites, or business integrations.</p>',
      },
      {
        heading: 'How users can request access, correction, deletion, or export of data',
        html: `<p>To request access, correction, deletion, or export of your data, contact us at ${LEGAL_CONTACT_EMAIL} from the email address associated with your account. Include your workspace email, the platform account involved, and the specific request. We may need to verify your identity before completing the request.</p>`,
      },
      {
        heading: "Children's privacy / age restrictions",
        html: '<p>Platform Multi Publisher is not intended for children. Users must be at least 18 years old, the age of majority in their jurisdiction, or the minimum age required by each connected platform, whichever is higher. Users must also satisfy the age and eligibility requirements of YouTube, TikTok, Instagram, Google, Meta, and any other connected platform.</p>',
      },
      {
        heading: 'International data transfers, if applicable',
        html: '<p>Depending on the hosting, service providers, and user location, data may be processed in Brazil and in other countries where Cloudflare or the listed service providers operate. Safeguards may include provider security controls, access controls, encryption in transit, and applicable contractual or data protection terms.</p>',
      },
      {
        heading: 'Changes to this Privacy Policy',
        html: '<p>We may update this Privacy Policy when our service, integrations, data practices, laws, or platform requirements change. If changes materially affect how we use platform data, we will update this page and, where required, notify users or request renewed consent.</p>',
      },
      {
        heading: 'Contact information',
        html: `<p>For privacy questions or requests, contact Lucas Domingues at ${LEGAL_CONTACT_EMAIL}. Business address: Alameda dos Mutuns.</p>`,
      },
    ],
  },
  terms: {
    key: 'terms',
    title: 'Termos de Servico',
    ptTitle: 'Termos de Servico',
    subtitle: 'The rules for using Platform Multi Publisher to connect accounts, manage campaigns and publish user-selected videos to YouTube, TikTok and Instagram.',
    lastUpdated: LEGAL_LAST_UPDATED,
    reviewNote: LEGAL_REVIEW_NOTE,
    sections: [
      {
        heading: 'Acceptance of terms',
        html: '<p>These Terms of Service ("Terms") govern access to and use of Platform Multi Publisher (the "Service"). By creating an account, connecting a platform account, uploading media, creating campaigns, or using the Service, you agree to these Terms.</p><p>If you use the Service for a company, client, or organization, you represent that you have authority to bind that entity to these Terms.</p>',
      },
      {
        heading: 'Description of the service',
        html: `<p>Platform Multi Publisher is a web application that helps users organize media, connect authorized YouTube, TikTok, and Instagram accounts, create publishing campaigns, configure captions and metadata, schedule or launch publishing jobs, and monitor publishing status from one workspace.</p><p>${LEGAL_TRANSPARENCY_NOTICE}</p>`,
      },
      {
        heading: 'Eligibility',
        html: '<p>You must be at least 18 years old, the age of majority in your jurisdiction, or the minimum age required by each connected platform, whichever is higher. You must also be legally able to enter into these Terms and comply with the eligibility rules of every third-party platform you connect to the Service.</p>',
      },
      {
        heading: 'User accounts',
        html: '<p>You are responsible for maintaining the confidentiality of your login credentials, sessions, connected accounts, and workspace access. You must provide accurate account information and keep it updated. You are responsible for all activity that occurs under your account, including activity by employees, contractors, clients, or collaborators you authorize.</p>',
      },
      {
        heading: 'TikTok integration',
        html: '<p>The TikTok integration allows users to connect a TikTok account through TikTok\'s authorization flow, identify the connected account, configure TikTok-specific campaign settings, upload or prepare selected videos, publish selected videos, and monitor publishing status.</p><p>The app requests TikTok scopes only for the stated functionality: <code>user.info.basic</code> to identify the connected account, <code>video.upload</code> to prepare selected videos for publishing, and <code>video.publish</code> to publish selected videos when instructed by the user. TikTok may approve, deny, limit, suspend, or modify access to these products and scopes.</p>',
      },
      {
        heading: 'User authorization and permissions',
        html: '<p>You choose which YouTube, TikTok, or Instagram accounts to connect. By completing an OAuth authorization flow, you authorize the Service to access the approved data and take the approved actions for that connected account. We will use platform permissions only to provide the features described in the Service and Privacy Policy.</p><p>You must not connect accounts that you do not own or are not authorized to manage. You can disconnect accounts in the workspace or revoke access directly from the relevant third-party platform settings.</p>',
      },
      {
        heading: 'User responsibilities',
        html: '<ul><li>You are responsible for the videos, thumbnails, captions, titles, descriptions, tags, privacy settings, playlist choices, schedules, and destinations you submit.</li><li>You must have all rights, permissions, licenses, and consents needed to upload and publish your content.</li><li>You must comply with the laws that apply to you and your content.</li><li>You must comply with TikTok, YouTube, Google, Instagram, Meta, and other third-party platform terms, policies, community guidelines, copyright rules, advertising rules, and API rules.</li><li>You are responsible for reviewing each campaign before launch and confirming that the selected destinations and metadata are correct.</li></ul>',
      },
      {
        heading: 'Prohibited uses',
        html: '<ul><li>Using the Service for spam, misleading content, scams, unlawful activity, harassment, impersonation, surveillance, scraping, or unauthorized data collection.</li><li>Uploading or publishing content that infringes intellectual property, privacy, publicity, contractual, or other rights.</li><li>Using connected platform data for advertising profiles, sale, resale, unauthorized sharing, or purposes not disclosed to users.</li><li>Bypassing platform limits, security controls, review requirements, rate limits, OAuth consent, or authorization flows.</li><li>Connecting accounts you do not own or manage with proper authorization.</li><li>Attempting to reverse engineer, disrupt, overload, attack, or gain unauthorized access to the Service or any third-party platform.</li><li>Using undocumented APIs or platform endpoints instead of official APIs made available for the relevant integration.</li></ul>',
      },
      {
        heading: 'Content ownership and licenses',
        html: '<p>You keep ownership of your content. By uploading content or creating a campaign, you grant Platform Multi Publisher a limited, non-exclusive, worldwide license to host, store, process, transmit, format, display within the workspace, and send your content and metadata to the platform destinations you select, solely to provide the Service.</p><p>You also authorize the connected third-party platforms to process and publish your content according to their own terms and your selected platform settings.</p>',
      },
      {
        heading: 'TikTok content and third-party services',
        html: '<p>TikTok, YouTube, Instagram, Google, Meta, payment processors, hosting providers, analytics providers, and other third-party services are independent from Platform Multi Publisher. Their services may be unavailable, delayed, changed, rate limited, suspended, or rejected for reasons outside our control.</p><p>Third-party platforms may review, reject, remove, limit, demonetize, restrict, or moderate content according to their own rules. We do not guarantee that a post will be accepted, published, remain available, receive views, or produce any specific outcome.</p>',
      },
      {
        heading: 'Privacy',
        html: '<p>Our Privacy Policy explains how we collect, use, store, share, and protect information. By using the Service, you acknowledge the Privacy Policy. The Privacy Policy is available at <a href="/privacy" data-link>https://www.plataformmultipublisher.com/privacy</a>.</p>',
      },
      {
        heading: 'Service availability',
        html: '<p>We aim to provide a reliable service, but we do not guarantee uninterrupted availability. The Service may be unavailable because of maintenance, outages, platform API issues, hosting issues, security events, rate limits, payment issues, or other reasons.</p>',
      },
      {
        heading: 'Fees, if applicable',
        html: '<p>Some features may be free, and others may require paid plans, tokens, subscriptions, or one-time purchases. Fees, taxes, billing periods, usage limits, and refund terms will be shown in the Service or checkout flow when applicable. Payment processing may be handled by third-party payment processors.</p>',
      },
      {
        heading: 'Termination',
        html: '<p>You may stop using the Service at any time. We may suspend or terminate access if you violate these Terms, create security or legal risk, fail to pay applicable fees, misuse platform APIs, or use the Service in a way that may harm users, platforms, or our operations. Platform providers may also revoke or limit integration access independently.</p>',
      },
      {
        heading: 'Disclaimers',
        html: '<p>The Service is provided "as is" and "as available." To the maximum extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, uninterrupted operation, error-free operation, and results from using the Service.</p>',
      },
      {
        heading: 'Limitation of liability',
        html: '<p>To the maximum extent permitted by law, Lucas Domingues will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost revenue, lost data, content removal, account suspension, platform rejection, or business interruption. Liability is limited to BRL 100 or the amount paid by the user to the Service in the 12 months before the claim, whichever is greater.</p>',
      },
      {
        heading: 'Indemnification',
        html: '<p>You agree to defend, indemnify, and hold harmless Lucas Domingues from claims, damages, liabilities, costs, and expenses arising from your content, your campaigns, your connected accounts, your violation of these Terms, your violation of law, your violation of third-party platform rules, or your infringement of third-party rights.</p>',
      },
      {
        heading: 'Changes to the terms',
        html: '<p>We may update these Terms from time to time. If changes materially affect your rights or obligations, we will update this page and, where required, provide notice. Continued use of the Service after changes take effect means you accept the updated Terms.</p>',
      },
      {
        heading: 'Governing law',
        html: '<p>These Terms are governed by the laws of Brazil, without regard to conflict of law rules, unless applicable law requires otherwise.</p>',
      },
      {
        heading: 'Contact information',
        html: `<p>Contact Lucas Domingues at ${LEGAL_CONTACT_EMAIL}. Business address: Alameda dos Mutuns.</p>`,
      },
    ],
  },
  'data-deletion': {
    key: 'data-deletion',
    title: 'Exclusao de Dados do Usuario',
    ptTitle: 'Exclusao de Dados do Usuario',
    subtitle: 'How users can request deletion of Platform Multi Publisher account data, connected account data and platform integration data.',
    lastUpdated: LEGAL_LAST_UPDATED,
    reviewNote: LEGAL_REVIEW_NOTE,
    sections: [
      {
        heading: 'How to request deletion',
        html: `<p>Email ${LEGAL_CONTACT_EMAIL} from the email address associated with your Platform Multi Publisher account. Use the subject "Data Deletion Request" and include your workspace email and the connected YouTube, TikTok, or Instagram account involved, if any.</p>`,
      },
      {
        heading: 'What data can be deleted',
        html: '<p>You may request deletion of user account data, connected platform account records, encrypted OAuth tokens, media records, campaign records, publishing job records, support/account metadata, and platform integration data held by Platform Multi Publisher.</p>',
      },
      {
        heading: 'Disconnecting platform access',
        html: '<p>You can disconnect a connected account inside the workspace accounts area. You can also revoke access directly in TikTok, Google/YouTube, Instagram, or Meta account settings under connected apps, third-party apps, apps/websites, or business integrations.</p>',
      },
      {
        heading: 'Verification',
        html: '<p>We may ask you to verify that you control the account email before processing a deletion request. This protects accounts from unauthorized deletion requests.</p>',
      },
      {
        heading: 'Processing time',
        html: '<p>We will process valid deletion requests within 30 days, unless a longer period is required or permitted by law.</p>',
      },
      {
        heading: 'Data we may retain',
        html: '<p>We may retain limited records when required for legal compliance, security, fraud prevention, dispute resolution, backup recovery, financial records, or unresolved campaign dependencies.</p>',
      },
      {
        heading: 'Contact',
        html: `<p>For deletion requests, contact Lucas Domingues at ${LEGAL_CONTACT_EMAIL}.</p>`,
      },
    ],
  },
};
