# Instagram Integration

## Overview

Instagram publishing lets a campaign target Instagram Business accounts alongside YouTube and TikTok targets. The flow is:

1. User connects an Instagram account through Meta OAuth.
2. Tokens are encrypted into `ConnectedAccount`.
3. A campaign target stores the Instagram account, caption, and feed-sharing option.
4. The Instagram worker creates a Reels media container from a public HTTPS video URL.
5. The worker polls container processing status, publishes the container, and stores `externalPublishId`.

## Configuration

Required production variables:

```env
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
INSTAGRAM_REDIRECT_URI=
PUBLIC_APP_URL=
OAUTH_TOKEN_KEY=
```

Sandbox/manual verification variables:

```env
RUN_INSTAGRAM_SANDBOX_E2E=true
INSTAGRAM_SANDBOX_CLIENT_ID=
INSTAGRAM_SANDBOX_CLIENT_SECRET=
INSTAGRAM_SANDBOX_REDIRECT_URI=
INSTAGRAM_SANDBOX_AUTH_CODE=
INSTAGRAM_SANDBOX_CODE_VERIFIER=
INSTAGRAM_SANDBOX_ACCESS_TOKEN=
INSTAGRAM_SANDBOX_REFRESH_TOKEN=
INSTAGRAM_SANDBOX_BUSINESS_ACCOUNT_ID=
INSTAGRAM_SANDBOX_PUBLIC_VIDEO_URL=
```

`PUBLIC_APP_URL` and any sandbox/public media URLs must use HTTPS and be reachable by Meta. The Instagram account used for publishing must be a Business or Creator account connected to the Meta app with content publishing permissions.

## User Guide

Connect Instagram from the accounts workspace, authorize the app, and return through the OAuth callback. After that, create or edit a campaign target with:

- Instagram account
- Reels caption
- Share-to-feed setting
- Platform-specific title/description/tags as fallback metadata

During publishing, campaign status shows Instagram targets with `externalPublishId`. YouTube targets continue to use `youtubeVideoId`; TikTok and Instagram targets use `externalPublishId`.

## API Reference

- `GET /api/accounts/oauth/instagram/start`: starts Meta OAuth and returns an Instagram redirect URL.
- `GET /api/accounts/oauth/instagram/callback`: handles the OAuth callback.
- `GET /api/accounts`: lists connected accounts, including Instagram.
- `POST /api/campaigns/:id/targets`: creates campaign targets. Use `platform: "instagram"` plus `connectedAccountId`.
- `GET /api/campaigns/:id/status`: returns mixed-platform progress, target status, and external IDs.
- `POST /api/campaigns/:id/launch`: enqueues due targets for publishing.

## Error Reference

| Error | Classification | User Action |
| --- | --- | --- |
| `OAuthException` or invalid access token | Permanent | Reconnect Instagram account |
| `invalid_grant` or revoked token | Permanent | Reconnect Instagram account |
| `invalid_media_url` | Permanent | Use an HTTPS public video URL |
| `missing_caption` | Permanent | Add a caption or fallback description |
| Unsupported media format or codec | Permanent | Export the video in a Reels-compatible format |
| Content policy or copyright rejection | Permanent | Edit or replace the video |
| `429`, `rate_limit_exceeded`, or `too_many_calls` | Transient | Worker backs off and retries later |
| `500`, `502`, `503`, or `504` | Transient | Retry after Meta recovers |
| Container processing timeout | Transient | Retry later or inspect media processing logs |

## Sandbox Testing

Runner-visible sandbox coverage lives in `tests/phase108/instagram-sandbox-e2e.test.ts`.

By default, real Meta calls are skipped. To run them manually:

```bash
RUN_INSTAGRAM_SANDBOX_E2E=true npx vitest run tests/phase108/instagram-sandbox-e2e.test.ts
```

Provide either a one-time auth code plus code verifier, or an access token for publish checks. The publish check also requires `INSTAGRAM_SANDBOX_BUSINESS_ACCOUNT_ID` and a small public HTTPS video URL.

## Smoke Testing

Run the production smoke script against a deployed app:

```bash
BASE_URL=https://app.example.com ./scripts/smoke-test-instagram.sh
```

The script checks required environment variables, redirect URL safety, the app root, the Instagram OAuth start endpoint, and optionally `SMOKE_TEST_PUBLIC_MEDIA_URL`.

## Security

- OAuth callback state is validated and consumed after success.
- PKCE code verifier is stored in the session during OAuth start.
- Access and refresh tokens are encrypted at rest.
- Refresh token revocation marks accounts as `reauth_required`.
- Tokens are not included in campaign status responses.

## Troubleshooting

- OAuth start returns 500: check `INSTAGRAM_CLIENT_ID` and `INSTAGRAM_REDIRECT_URI`.
- OAuth callback fails with invalid state: restart the connection flow.
- Publish fails before API call: check that the target has a connected Instagram account.
- Container creation fails with URL errors: verify `PUBLIC_APP_URL` is HTTPS and publicly downloadable.
- Container stays in progress: retry later; processing time can vary by media size and Meta load.
- Publish succeeds but campaign still shows pending: inspect worker logs for `externalPublishId` and target status updates.
