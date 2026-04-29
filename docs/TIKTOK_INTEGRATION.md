# TikTok Integration

## Overview

TikTok publishing lets a campaign target TikTok accounts alongside YouTube targets. The flow is:

1. User connects a TikTok account through OAuth.
2. Tokens are encrypted into `ConnectedAccount`.
3. A campaign target stores TikTok account, privacy, and moderation settings.
4. The TikTok worker generates a public media URL and starts Direct Post with `PULL_FROM_URL`.
5. The worker polls TikTok status and stores `externalPublishId` when the post completes.

## Configuration

Required production variables:

```env
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=
PUBLIC_APP_URL=
OAUTH_TOKEN_KEY=
```

Sandbox/manual verification variables:

```env
TIKTOK_SANDBOX=true
RUN_TIKTOK_SANDBOX_E2E=true
TIKTOK_SANDBOX_CLIENT_KEY=
TIKTOK_SANDBOX_CLIENT_SECRET=
TIKTOK_SANDBOX_REDIRECT_URI=
TIKTOK_SANDBOX_AUTH_CODE=
TIKTOK_SANDBOX_CODE_VERIFIER=
TIKTOK_SANDBOX_ACCESS_TOKEN=
TIKTOK_SANDBOX_REFRESH_TOKEN=
TIKTOK_SANDBOX_PUBLIC_VIDEO_URL=
```

`PUBLIC_APP_URL` must be an HTTPS URL reachable by TikTok, and the same domain must be registered in TikTok URL properties for Direct Post.

## User Guide

Connect TikTok from the accounts workspace, authorize the app, and return through the OAuth callback. After that, create or edit a campaign target with:

- TikTok account
- Privacy level
- Comment, duet, and stitch toggles
- Platform-specific title/description/tags

During publishing, campaign status shows TikTok targets with `externalPublishId`. YouTube targets continue to use `youtubeVideoId`.

## API Reference

- `GET /api/accounts/oauth/tiktok/start`: starts TikTok OAuth and returns a TikTok redirect URL.
- `GET /api/accounts/oauth/tiktok/callback`: handles TikTok OAuth callback.
- `GET /api/accounts`: lists connected accounts, including TikTok.
- `POST /api/campaigns/:id/targets`: creates campaign targets. Use `platform: "tiktok"` plus `connectedAccountId`.
- `GET /api/campaigns/:id/status`: returns mixed-platform progress, target status, and external IDs.
- `POST /api/campaigns/:id/launch`: enqueues due targets for publishing.

## Error Reference

| Error | Classification | User Action |
| --- | --- | --- |
| `10001` invalid access token | Permanent | Reconnect TikTok account |
| `10002` token expired | Transient | Retry after token refresh |
| `invalid_grant` | Permanent | Reconnect TikTok account |
| `429` or `rate_limit_exceeded` | Transient | Worker backs off and retries |
| Content Policy Violation | Permanent | Edit or replace the video |
| Copyright Music | Permanent | Remove music or use an approved track |
| Media URL not accessible | Transient | Verify public URL and retry |
| Network timeout / `ECONNREFUSED` | Transient | Retry later |

## Rate Limits

TikTok limits are tracked per connected TikTok account:

- 6 publishes per rolling minute
- 15 publishes per UTC day

The worker also retries TikTok 429 responses with exponential backoff. If local quota is already reached, the worker skips the API call, keeps the campaign target waiting, and marks the job as transient so it can be retried later.

## Sandbox Testing

Runner-visible sandbox coverage lives in `tests/phase107/tiktok-sandbox-e2e.test.ts`.

By default, real TikTok calls are skipped. To run them manually:

```bash
RUN_TIKTOK_SANDBOX_E2E=true npx vitest run tests/phase107/tiktok-sandbox-e2e.test.ts
```

Provide either a one-time auth code plus code verifier, or an access token for publish-status checks. Use a small public HTTPS video URL; TikTok sandbox has stricter file-size constraints than production.

## Security

- OAuth callback state is validated and consumed after success.
- Access and refresh tokens are encrypted at rest.
- Refresh token revocation marks accounts as `reauth_required`.
- Tokens are not included in campaign status responses.

## Troubleshooting

- OAuth start returns 500: check `TIKTOK_CLIENT_KEY` and `TIKTOK_REDIRECT_URI`.
- OAuth callback fails with invalid state: restart the connection flow.
- Publish fails before API call: check local quota and retry after `retryAfter`.
- Publish fails with URL errors: verify `PUBLIC_APP_URL` is HTTPS and publicly downloadable.
- Publish succeeds but campaign keeps polling: inspect TikTok status fetch response and worker logs for the `publish_id`.
