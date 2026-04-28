# Research: TikTok Integration for YT Multi-Publisher

**Research Date:** 2026-04-28  
**Phase:** 2 (TikTok Integration)  
**Objective:** Answer "What do I need to know to PLAN TikTok integration well?"

---

## Executive Summary

TikTok integration is fundamentally different from YouTube due to:
- **Upload model**: TikTok requires public HTTP URLs (not direct file uploads)
- **Account targeting**: Single account per OAuth session (no multi-channel per token)
- **API maturity**: Recent API (sandbox mode available), good documentation
- **Approval constraints**: App review takes 3-7 days; creator accounts auto-approved

**Key wins over YouTube:**
- Chunked upload support built-in (5-64 MB chunks)
- Public URL + download model aligns perfectly with R2 storage
- No special scopes needed (basic "video.list" scope sufficient)

**Key constraints vs YouTube:**
- Rate limits: 6 videos/min, 15 videos/day (content posting quota)
- No resumable upload (chunked, not resumable protocol)
- Video review by TikTok can fail (content policy enforcement)
- Sandbox testing has 128 MB file size limit (not 10 GB)

---

## Section 1: TikTok API Overview

### Official API & SDKs

**Official API:** TikTok Open API (v2)  
- **URL:** https://developers.tiktok.com/  
- **Documentation:** Comprehensive official docs for all endpoints
- **Status:** Actively maintained; major updates every quarter

**SDK Availability for Node.js:**
1. **node-tiktok-sdk** (GitHub: sebastianobar/node-tiktok-sdk) — Simple OAuth wrapper
2. **Auth.js TikTok Provider** — Framework-agnostic OAuth support
3. **TikApi** (npmjs: tikapi) — Fully managed alternative API
4. **Unofficial TikTok APIs** — Not recommended for production (unreliable, may violate ToS)

**Recommendation:** Use official TikTok SDK + raw HTTP calls for Content Posting API. OAuth handled via Auth.js or custom implementation (small enough to hand-code).

### Authentication Method

**Type:** OAuth 2.0 (standard, not custom)

**Flow:**
1. User redirected to TikTok authorization endpoint with `client_id`, `scopes`, `state`, `redirect_uri`
2. User grants permissions (can deny individual scopes)
3. TikTok redirects back with `authorization_code`
4. Backend exchanges code for `access_token` + `refresh_token`
5. Tokens stored encrypted in database (existing pattern in codebase)

**Token Details:**
- **Access Token:** Short-lived (typically 2 hours)
- **Refresh Token:** Long-lived (~1 year or until revoked)
- **Expiry:** Included in token response as `expires_in` (seconds)
- **Refresh Mechanism:** PKCE optional (recommended for security; codebase already has PKCE support for Google)

**Scopes Needed:**
- `video.upload`: Upload videos
- `video.publish`: Publish videos
- `user.info.basic`: Get account info (handle, etc.)
- **Important:** Only request scopes needed; users can deny individual scopes

### API Endpoints for Integration

**Video Upload (3-step process):**
1. `POST /v1/post/publish/video/init/` — Initialize upload, get `upload_url` + `publish_id`
2. `POST {upload_url}` — Chunked upload to presigned URL
3. `POST /v1/post/publish/status/fetch/` — Poll for completion (PUBLISH_COMPLETE or FAILED)

**Creator Info:**
- `POST /v1/post/publish/creator_info/query/` — Get privacy level options, duet/stitch/comment settings

**Account Info:**
- `GET /v2/user/info/` — Get user profile (handle, follower count, avatar)

### Rate Limits & Quotas

**Content Posting API:**
- **Per-minute rate limit:** 6 videos per minute (hard stop)
- **Daily limit:** 15 videos per day
- **Enforcement:** HTTP 429 with `rate_limit_exceeded` error code
- **Retry strategy:** 1-minute sliding window; implement exponential backoff

**Research API (if needed for analytics):**
- **Daily limit:** 1,000 requests/day
- **Records per request:** Up to 100 records per request

**Free Tier:**
- All content posting is free (no API pricing)
- App review process is free
- No token/credit system like YouTube Data API

### Cost Model

- **API calls:** Free
- **Video storage:** No TikTok storage (you host on R2)
- **Bandwidth:** Free (TikTok downloads from your R2 URL)
- **Approval:** Free developer account
- **Timeline:** No metered billing, no surprise costs

**Comparison to YouTube:**
- YouTube Data API: ~$1 per 1,000 requests (after 10k/day free quota)
- TikTok: $0 (free forever for content posting)

### Documentation Quality & Community

**Official docs:** Excellent — API reference, error handling, integration guides  
**Community:** Smaller than YouTube but growing (helpful GitHub discussions)  
**SDKs:** Multiple Node.js options available  
**Common pitfalls:** Well-documented in official error handling guide

---

## Section 2: Video Upload Process

### Supported Formats

**Video Codecs:**
- **Recommended:** H.264 (best compatibility, fastest processing)
- **Accepted:** H.265, MPEG-4 Part 2

**Audio Codecs:**
- **Recommended:** AAC
- **Accepted:** MP3, Vorbis

**Container Formats:**
- **Web/Desktop:** MP4, MOV, WebM
- **Mobile (iOS/Android):** MP4, MOV
- **Recommendation for our use:** MP4 (universal, widely supported)

**Video Dimensions:**
- **Optimal:** 1080x1920 (vertical, portrait)
- **Aspect ratio:** 9:16 (TikTok native)
- **Acceptable range:** 4:5 to 16:9 (will be letterboxed/cropped)

**Duration:**
- **Minimum:** 3 seconds
- **Maximum:** 600 seconds (10 minutes via API; 10 minutes via web)
- **Typical:** 15-60 seconds (content strategy, not API hard limit)

### Size Limits

**File Size:**
- **API limit:** 4 GB maximum
- **Sandbox limit:** 128 MB maximum (for testing)
- **Production:** 4 GB
- **Practical limit for R2:** 500 MB (aligns with typical video quality/platform requirements)

**Chunked Upload Details:**
- **Chunk size (all but last):** 5 MB minimum, 64 MB maximum
- **Final chunk:** Can exceed chunk_size, up to 128 MB (for trailing bytes)
- **Total chunks:** Minimum 1, maximum 1,000 chunks
- **Sequential upload:** Must upload chunks in order; TikTok validates sequence

**Example:** 100 MB video = 2 chunks (64 MB + 36 MB)

### Resumable Upload Support

**Type:** Chunked (NOT resumable protocol)

**Key difference from YouTube:**
- YouTube: Resumable protocol (can pause, resume, skip chunks, check upload position)
- TikTok: Chunked (upload sequentially, one chunk at a time)

**Implications:**
- Simpler to implement (no seek/resume tracking)
- Must upload chunks in order (no parallelization)
- If chunk fails: Entire upload must restart (no checkpoint)
- Progress tracking: Monitor byte position + chunk count

**Implementation approach:**
```typescript
// Pseudocode
for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
  const chunk = await file.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE);
  await uploadChunk(uploadUrl, chunk, chunkIndex);
  // Update job progress: (chunkIndex + 1) / totalChunks * 100%
}
```

### Metadata Requirements

**Required:**
- `title`: Video title (max 2,200 characters)
- `privacy_level`: PUBLIC_TO_EVERYONE, FOLLOWER_OF_CREATOR, or SELF_ONLY

**Optional:**
- `disable_comment`: Boolean (allow comments)
- `disable_duet`: Boolean (allow duets)
- `disable_stitch`: Boolean (allow stitches)

**Caption/Description:**
- Title field is the caption (supports hashtags, mentions, newlines)
- No separate description field (unlike YouTube)
- Hashtags included in title count toward 2,200 character limit

**Tags/Hashtags:**
- Included in title (no separate tags field)
- Formatted as `#hashtag` (TikTok auto-links)
- Max ~10 hashtags recommended (no hard limit, but UX degrades)

### Post-Upload Processing

**Processing time:** Variable, typically 1-10 minutes
- **Status polling:** Must call status endpoint every 5 seconds (max 6 attempts = 30 seconds baseline)
- **Completion states:**
  - `PUBLISH_COMPLETE`: Video ready (includes `publicly_available_post_id`)
  - `FAILED`: Upload or review failed (includes `fail_reason`)
  - `PROCESSING`: Still uploading/processing
- **Timeout:** If no completion after ~30 seconds, retry the entire upload sequence

### Direct Post from Public URL

**Endpoint:** `POST /v1/post/publish/video/init/`

**Method:** `source: "PULL_FROM_URL"` instead of chunked upload

**How it works:**
1. App sends video URL (from R2) to TikTok
2. TikTok downloads video from URL
3. URL must remain accessible for 1 hour (timeout period)
4. TikTok processes, then calls status endpoint to check progress

**Pros:**
- Simpler (no chunked upload logic)
- Faster (TikTok downloads in parallel)
- Lower app bandwidth (video streamed from R2, not through app)

**Cons:**
- URL must be publicly accessible for 1 hour
- R2 bucket must allow downloads without authentication
- Requires public URLs (already planned for Phase 1)

**Decision for our integration:**
- Use `PULL_FROM_URL` method (simpler, already have public R2 URLs)
- No chunked upload logic needed
- Lower operational overhead

---

## Section 3: Account Connection & OAuth

### User Flow: Connecting TikTok Account

**Step 1: User clicks "Connect TikTok"**
```
UI: "accounts/tiktok/connect" button
```

**Step 2: App redirects to TikTok authorization**
```
GET https://www.tiktok.com/v1/oauth/authorize/
  ?client_key={CLIENT_KEY}
  &response_type=code
  &scope=video.upload video.publish user.info.basic
  &redirect_uri=https://app.example.com/accounts/oauth/tiktok/callback
  &state={STATE_TOKEN}
  &code_challenge={PKCE_CHALLENGE}
  &code_challenge_method=S256
```

**Step 3: User grants permissions**
- TikTok shows consent screen
- User can deny individual scopes
- User approves or denies entire request

**Step 4: TikTok redirects back**
```
GET https://app.example.com/accounts/oauth/tiktok/callback
  ?code={AUTHORIZATION_CODE}
  &state={STATE_TOKEN}
```

**Step 5: Backend exchanges code for tokens**
```
POST https://open.tiktokapis.com/v1/oauth/token/
  grant_type=authorization_code
  client_key={CLIENT_KEY}
  client_secret={CLIENT_SECRET}
  code={AUTHORIZATION_CODE}
  code_verifier={PKCE_VERIFIER}
```

**Response:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 7200,
  "token_type": "Bearer"
}
```

**Step 6: Store encrypted tokens**
- Follow existing pattern (TokenCryptoService)
- Encrypt access + refresh token
- Store expiry time (`now + expires_in`)
- Mark account as `connected`

**Step 7: Fetch account info**
- Call `GET /v2/user/info/` to get TikTok handle
- Store as `displayName` (existing schema supports this)
- Mark sync complete

### Multi-Account Support

**Per user:** Multiple TikTok accounts supported (like YouTube)

**Key difference from YouTube:**
- YouTube: One token = access to all user's channels
- TikTok: One token = one TikTok account (each account needs separate OAuth)

**Flow in app:**
1. User clicks "Connect another TikTok account"
2. User taken through OAuth flow again (may be logged in as different TikTok user)
3. Each ConnectedAccount record = one TikTok account
4. Each account can be used in campaigns independently

**In campaign targeting:**
- Select which connected TikTok account to publish to
- One target = one account (no multi-account in single target)

### Token Refresh Strategy

**When to refresh:**
- Before every API call: Check if token expires within 5 minutes
- If yes: Call refresh endpoint, update stored tokens, retry API call

**Refresh endpoint:**
```
POST https://open.tiktokapis.com/v1/oauth/token/
  grant_type=refresh_token
  client_key={CLIENT_KEY}
  client_secret={CLIENT_SECRET}
  refresh_token={REFRESH_TOKEN}
```

**Response:** New `access_token`, new `refresh_token`, updated `expires_in`

**Error handling:**
- `invalid_grant`: Refresh token expired or revoked (user must re-auth)
- Other errors: Transient, implement exponential backoff

**Existing pattern:** Follow `AccountsService.refreshAccessTokenIfNeeded()` method (already handles refresh for Google)

### Scopes & Permissions

**Minimal scopes for publishing:**
- `video.upload`: Upload video files (required)
- `video.publish`: Publish uploaded videos (required)
- `user.info.basic`: Get account info (recommended)

**NOT needed:**
- `video.delete`: Only if we support deletion (v2 feature)
- `analytics`: Only if we show TikTok analytics (v2 feature)

**User experience:**
- Request only necessary scopes (users see minimal permission list)
- Scopes shown to user; they can grant individually
- If user denies `video.publish`, account is useless for publishing (handle gracefully)

---

## Section 4: Campaign Targeting & Publishing

### How to Target a TikTok Account

**In campaign creation UI:**
1. User selects platform: "TikTok"
2. User selects connected TikTok account (dropdown of all connected accounts)
3. User selects optional settings: privacy level, disable comments/duets/stitches
4. Campaign target record created with `connectedAccountId` + privacy settings

**In database schema:**
```sql
campaign_targets (
  id: UUID,
  campaign_id: UUID,
  platform: 'youtube' | 'tiktok',
  connected_account_id: UUID,  -- Reference to ConnectedAccount
  video_title: string,
  video_description: string,
  tags: string[],
  privacy: 'public' | 'unlisted' | 'private',
  -- TikTok specific:
  disable_comment: boolean,
  disable_duet: boolean,
  disable_stitch: boolean,
  -- Status tracking:
  status: 'pending' | 'publicado' | 'erro',
  external_publish_id: string,  -- TikTok's publicly_available_post_id
  error_message: string,
)
```

### Single vs Multiple Accounts per Campaign

**Design decision:** One target = one TikTok account

**Why:**
- TikTok OAuth token = one account
- Each account has separate limits (15 videos/day per account)
- Separate publish status tracking per account

**Multi-account publishing:**
- Create separate campaign targets for each TikTok account
- Same video published to multiple accounts (parallel jobs)
- Campaign shows progress per target

**Example:**
```
Campaign: "Summer Promo"
  Target 1: @my_main_tiktok (connected account A)
  Target 2: @my_business_account (connected account B)

When published:
  Job 1: Download video -> Publish to @my_main_tiktok
  Job 2: Download video -> Publish to @my_business_account
```

### Privacy & Content Settings

**Privacy levels offered to user:**
1. `PUBLIC_TO_EVERYONE`: Anyone can see (default)
2. `FOLLOWER_OF_CREATOR`: Followers only
3. `SELF_ONLY`: Draft (creator only)

**Mapping user input to TikTok:**
```typescript
function selectTikTokPrivacyLevel(campaignPrivacy: 'public' | 'unlisted' | 'private', availableOptions: string[]): string {
  const preferred = campaignPrivacy === 'public' 
    ? 'PUBLIC_TO_EVERYONE'
    : campaignPrivacy === 'unlisted'
      ? 'FOLLOWER_OF_CREATOR'
      : 'SELF_ONLY';
  
  if (availableOptions.includes(preferred)) return preferred;
  return availableOptions[0] || 'SELF_ONLY'; // Fallback
}
```

**Content moderation options (queryable from API):**
- `disable_comment`: Disable comments
- `disable_duet`: Disable duets
- `disable_stitch`: Disable stitches

**Workflow:**
1. Get creator info: `POST /v1/post/publish/creator_info/query/` → returns available privacy levels + moderation defaults
2. Present options to user in campaign creation UI
3. Publish with selected settings

---

## Section 5: Storage Integration (R2 Compatibility)

### Can TikTok Download from S3-Compatible Storage (R2)?

**Answer:** YES, fully compatible

**How it works:**
1. App uploads video to R2 (existing workflow)
2. Generate public URL: `https://media.r2.yourapp.com/videos/{uuid}.mp4`
3. Call TikTok API with URL: `POST /v1/post/publish/video/init/` with `source: "PULL_FROM_URL"` + `video_url: "https://..."`
4. TikTok downloads from URL over HTTPS (standard HTTP GET)
5. Upload completes, status polled

### URL Requirements

**Format:**
- Public HTTPS URL (required; HTTP not supported)
- No authentication headers needed (public R2 bucket)
- No signed URL needed (permanent public URLs work)

**Accessibility:**
- Must be accessible for 1 hour (timeout window for TikTok to download)
- R2 must have CORS configured (if accessed from browser, which it won't be for direct post)

**R2 Configuration:**
```
Bucket visibility: Public
CORS: Not required (server-to-server download, no browser involved)
Custom domain: Optional but recommended (e.g., `media.r2.yourapp.com`)
Public URL format: `https://{bucket}.r2.{account}.com/videos/{uuid}.mp4`
```

### CORS & Origin Restrictions

**Direct POST method (server-to-server):**
- CORS not involved (TikTok server downloads from R2 server)
- No browser CORS headers needed
- Works regardless of R2 CORS configuration

**Browser-based download (if implemented in UI):**
- CORS would be needed
- R2 supports CORS configuration
- TikTok domain: Not needed (only for user downloading directly)

### Performance & Bandwidth Considerations

**Download method:**
- TikTok downloads video from R2 directly (not through your app)
- Your app bandwidth: ~0 (no egress)

**Speed:**
- Depends on TikTok's download speed (typically fast, ~1 MB/s)
- R2 egress to TikTok: Free (Cloudflare perk)

**Reliability:**
- Video must remain on R2 for 1 hour (can delete after)
- If URL becomes inaccessible: Upload fails with specific error code

### Recommended Implementation

**Video upload workflow:**
```
1. User uploads video to R2 (client → R2 direct upload)
2. Get public URL: https://media.r2.yourapp.com/videos/{videoId}.mp4
3. Create campaign, select TikTok target
4. On publish:
   a. Get access token for TikTok account
   b. POST /v1/post/publish/video/init/ with video_url (PULL_FROM_URL)
   c. Receive publish_id
   d. Poll /v1/post/publish/status/fetch/ every 5 seconds (6 attempts = 30s timeout)
   e. If PUBLISH_COMPLETE: Store publicly_available_post_id, mark campaign complete
   f. If FAILED: Mark campaign failed with fail_reason
5. After publish confirmed: Can delete from R2 (optional) to save storage
```

---

## Section 6: Testing Strategy

### Official Sandbox Environment

**Status:** Available, fully functional for testing

**Limitations:**
- Content Posting API: No direct upload testing (only PULL_FROM_URL tested)
- No real TikTok video posting (drafts only in sandbox)
- File size limit: 128 MB (vs 4 GB production)

**How to use:**
1. Create TikTok Developer account (free)
2. Create app in TikTok Developer Console
3. Enable Sandbox mode
4. Add test TikTok accounts (up to 10)
5. Use test accounts to grant OAuth permissions
6. Test full flow: init → poll → verify

**Sandbox test accounts:**
- Create test accounts in TikTok developer portal
- These accounts only work in sandbox (restricted)
- No real followers; used purely for testing

### Testing Without Real TikTok Videos

**Option 1: Sandbox with Test Accounts (Recommended)**
- Create free TikTok accounts for testing
- Go through real OAuth flow
- Upload test videos (draft only in sandbox)
- Verify API responses, error handling

**Option 2: Mock the TikTok API (Unit/Integration Tests)**
- Mock `tiktokDirectPostFromUrl()`, `tiktokFetchPublishStatus()`, `tiktokQueryCreatorInfo()`
- Inject mocks into TikTokUploadWorker (already done in codebase)
- Test error handling: retry logic, rate limiting, token refresh
- Test campaign status transitions

**Option 3: Integration Test with Staging Credentials**
- Create a dedicated staging TikTok account
- Use real staging credentials (not production account)
- Test once per day (respects 15 video/day limit)
- Don't publish to real account (SELF_ONLY privacy)

### Mocking Strategy (for unit tests)

**Existing pattern in codebase:**
```typescript
// From TikTokUploadWorkerOptions
interface TikTokUploadWorkerOptions {
  queryCreatorInfoFn?: TikTokQueryCreatorInfoFn;     // Mockable
  publishFn?: TikTokPublishFn;                       // Mockable
  fetchStatusFn?: TikTokFetchStatusFn;               // Mockable
}

// In tests:
const mockPublishFn = async () => ({ publishId: 'mock-id-123' });
const mockStatusFn = async () => ({ status: 'PUBLISH_COMPLETE', publiclyAvailablePostId: 'v-456' });
const worker = new TikTokUploadWorker({ publishFn: mockPublishFn, fetchStatusFn: mockStatusFn, ... });
```

**Test cases to cover:**
1. Happy path: Init → poll success → complete
2. Poll timeout: Init succeeds, poll times out after 6 attempts
3. Publish failure: Init fails with error message
4. Creator info fetch: Get privacy options, select correct level
5. Token refresh: Refresh token before API call, retry
6. Rate limiting: Mock 429 response, implement backoff
7. Invalid privacy level: API rejects privacy level, fallback to SELF_ONLY

### Sandbox vs Production Discrepancies

**Known issues (from research):**
- Sandbox: 128 MB file limit (production: 4 GB)
- Sandbox: Draft only (no public posting)
- Sandbox: Slower API responses (test infrastructure)

**Mitigation:**
- Test with files <128 MB in sandbox
- Test full flow: init → poll → status
- Test error scenarios (retry, timeout)
- Once in production, verify with small real video (5-10 MB)

---

## Section 7: Integration Pitfalls & Solutions

### Pitfall 1: Token Expiration (Authentication Errors)

**Problem:**
- Access tokens expire every ~2 hours
- No notification when token expires
- Next API call fails with `Error 10001: Invalid Access Token`

**Solution:**
1. Store token expiry time (`now + expires_in`)
2. Before every API call: Check if token expires within 5 minutes
3. If yes: Call refresh endpoint, get new token, retry API call
4. Existing pattern: `AccountsService.refreshAccessTokenIfNeeded()` handles this

**Code pattern (existing in YouTube integration):**
```typescript
const refreshResult = await accountsService.refreshAccessTokenIfNeeded(account);
if (refreshResult.error === 'REAUTH_REQUIRED') {
  // Mark account for re-authentication, prompt user
  throw new Error('REAUTH_REQUIRED');
}
const accessToken = readPersistedTokens(refreshResult.account).accessToken;
```

### Pitfall 2: Rate Limiting (6 videos/minute, 15/day)

**Problem:**
- API returns HTTP 429 if exceeds limits
- Hard limits; no burst capacity
- Affects user experience if publishing many videos

**Solution:**
1. Implement exponential backoff: Wait 1s, then 2s, then 4s, etc.
2. Track published count per account (24-hour rolling window)
3. In UI: Warn user if approaching daily limit (e.g., "13 of 15 videos published today")
4. Queue system (Bull/BullMQ): Stagger jobs across accounts, don't burst all at once

**Code pattern:**
```typescript
async function publishWithRetry(publishFn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await publishFn();
    } catch (error) {
      if (error.statusCode === 429) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
}
```

### Pitfall 3: Video URL Accessibility (1-hour timeout)

**Problem:**
- TikTok downloads video from public URL
- URL must remain accessible for up to 1 hour
- If URL becomes inaccessible: Upload fails silently

**Solution:**
1. Do NOT delete video from R2 until publish confirmed
2. Keep video on R2 for at least 1 hour after publish starts
3. Monitor upload status: If failure, check R2 bucket (file still there)
4. Set R2 lifecycle policy: Delete videos older than 7 days (cleanup)

**Workflow:**
```typescript
// On publish start:
1. Confirm video exists on R2
2. Call TikTok init endpoint with URL
3. Receive publish_id
4. Poll status endpoint every 5s
5. Once PUBLISH_COMPLETE: Video safely downloaded by TikTok
6. Can delete from R2 (optional, after 1-2 hours confirmation)

// If FAILED:
1. Video may still be on R2 (TikTok couldn't download)
2. Retry: Call init again (same video file)
3. Or: Delete corrupted file, re-upload, retry
```

### Pitfall 4: Privacy Level Validation

**Problem:**
- User selects privacy level, but not all levels available for all accounts
- API rejects invalid privacy level

**Solution:**
1. Query creator info before presenting UI options
2. Only show privacy levels available for that account
3. If somehow invalid level selected: Fall back to SELF_ONLY

**Code pattern (existing in codebase):**
```typescript
// Before publishing:
const creatorInfo = await queryCreatorInfoFn(accessToken);
const privacyLevel = selectTikTokPrivacyLevel(target.privacy, creatorInfo.privacyLevelOptions);
// selectTikTokPrivacyLevel() handles fallback to first available option
```

### Pitfall 5: Chunked Upload Sequencing

**Problem:**
- If uploading chunks, must upload in order
- TikTok validates chunk sequence
- Out-of-order chunks rejected

**Solution:**
- Use PULL_FROM_URL method instead (simpler, no chunking)
- If chunked upload needed: Upload sequentially, don't parallelize
- Track chunk index, validate response before moving to next

### Pitfall 6: Content Policy Violations

**Problem:**
- TikTok can reject video after upload completes
- Rejection reason not always clear
- Account can be flagged if policy violations repeated

**Solution:**
1. Educate users: Document TikTok content policy
2. Status polling: Capture `fail_reason` from TikTok, show to user
3. Audit: Log all rejections, identify patterns
4. Escalation: If account repeatedly rejected, notify user to check account status

**Common rejection reasons:**
- Copyright music (TikTok's music library required)
- Spam/misleading content
- Explicit content (policy varies by account age)

### Pitfall 7: Sandbox vs Production Switching

**Problem:**
- Sandbox has 128 MB file limit; production 4 GB
- Sandbox responses may differ from production
- App working in sandbox but failing in production

**Solution:**
1. Test in sandbox with files <128 MB (covers most use cases)
2. Document known differences (file size, speed)
3. Once in production: Test with real video (but not publish to real account initially)
4. Use SELF_ONLY privacy for first real test (safe, only creator can see)

### Pitfall 8: OAuth State Validation

**Problem:**
- State token can be reused (CSRF attack)
- Session not properly validated

**Solution:**
- Existing pattern: Store state token with TTL (10 minutes), mark as consumed
- Validate state before exchanging code
- Reject if state invalid or expired

**Code pattern (existing in AccountsService):**
```typescript
private rememberOauthState(state: string, adminEmail?: string): void {
  this.oauthStateStore.set(state, {
    createdAtMs: this.now().getTime(),
    adminEmail,
  });
}

private consumeOauthState(state: string, adminEmail?: string): boolean {
  const record = this.oauthStateStore.get(state);
  if (!record) return false; // Invalid state
  
  this.oauthStateStore.delete(state); // Consume, prevent reuse
  return true;
}
```

### Pitfall 9: Refresh Token Revocation

**Problem:**
- User may revoke TikTok OAuth permission in TikTok settings
- Refresh token becomes invalid
- App continues to try refresh, fails every time

**Solution:**
1. Detect revocation error: `invalid_grant` error code
2. Mark account as `reauth_required` (existing schema)
3. Show UI prompt: "TikTok account disconnected, please reconnect"
4. User clicks "Reconnect", goes through OAuth again

**Code pattern:**
```typescript
private isAuthorizationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('invalid_grant') || message.includes('token has been revoked');
}

// In refreshAccessTokenIfNeeded():
catch (error: unknown) {
  if (this.isAuthorizationError(error)) {
    return { error: 'REAUTH_REQUIRED', account: updatedAccount };
  }
  throw error;
}
```

### Pitfall 10: API Response Parsing

**Problem:**
- TikTok API responses sometimes have inconsistent field names
- Optional fields may be missing
- Field values may be null/undefined unexpectedly

**Solution:**
1. Strict response parsing (type-safe field extraction)
2. Provide default values for optional fields
3. Log full API response on parsing error (for debugging)

**Code pattern (existing in codebase):**
```typescript
function readStringField(value: Record<string, unknown> | null | undefined, key: string): string | null {
  const raw = value?.[key];
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

// Usage:
const status = readStringField(data, 'status');
if (!status) throw new Error('TikTok API did not return status field');
```

---

## Section 8: Validation Architecture (How to Verify Integration Works)

### Testing Dimensions

#### 1. Unit Tests (Mocking)
**What:** Test business logic in isolation  
**How:** Mock TikTok API functions  
**Coverage:**
- Privacy level selection logic
- Title building (hashtag formatting)
- Error classification
- Token refresh logic
- Campaign status transitions

**Example test:**
```typescript
describe('TikTokUploadWorker', () => {
  it('should select SELF_ONLY when public not available', async () => {
    const mockCreatorInfo = {
      privacyLevelOptions: ['SELF_ONLY', 'FOLLOWER_OF_CREATOR'],
    };
    const privacy = selectTikTokPrivacyLevel('public', mockCreatorInfo.privacyLevelOptions);
    expect(privacy).toBe('FOLLOWER_OF_CREATOR'); // Fallback to next best option
  });
  
  it('should retry on rate limit (429)', async () => {
    let attemptCount = 0;
    const mockPublish = async () => {
      attemptCount++;
      if (attemptCount < 2) throw new Error('HTTP 429: Rate limited');
      return { publishId: 'id-123' };
    };
    const result = await publishWithRetry(mockPublish);
    expect(attemptCount).toBe(2);
  });
});
```

#### 2. Integration Tests (Sandbox)
**What:** Test full flow with TikTok Sandbox  
**How:** Real OAuth, real API calls (to sandbox)  
**Coverage:**
- OAuth callback handling
- Token storage + encryption
- Creator info fetch
- Video publish initialization
- Status polling
- Error handling

**Setup:**
```bash
# Create sandbox test account, add to .env.test
TIKTOK_TEST_ACCOUNT_EMAIL=test@example.com
TIKTOK_TEST_ACCOUNT_PASSWORD=***
TIKTOK_SANDBOX_CLIENT_ID=***
TIKTOK_SANDBOX_CLIENT_SECRET=***
```

**Example test:**
```typescript
describe('TikTok Integration (Sandbox)', () => {
  it('should upload and poll video status', async () => {
    // 1. OAuth flow
    const account = await handleOauthCallback(sandboxCode);
    expect(account.status).toBe('connected');
    
    // 2. Publish flow
    const publishId = await initPublish(account.id, { videoUrl: '...', title: '...' });
    expect(publishId).toBeTruthy();
    
    // 3. Poll status
    let status = await fetchPublishStatus(account.id, publishId);
    while (status.status !== 'PUBLISH_COMPLETE' && status.status !== 'FAILED') {
      await sleep(5000);
      status = await fetchPublishStatus(account.id, publishId);
    }
    
    expect(status.status).toBe('PUBLISH_COMPLETE');
    expect(status.publiclyAvailablePostId).toBeTruthy();
  });
});
```

#### 3. End-to-End Tests (Production)
**What:** Test with real TikTok account (once approved)  
**How:** Create campaign with real video, publish to real TikTok account  
**Frequency:** Once per week (respects 15 videos/day limit)  
**Account:** Use dedicated test account, set privacy to SELF_ONLY

**Verification:**
- Video uploaded and appears in creator's draft list
- Campaign status transitions: pending → publicado
- externl publish ID stored in database
- No double-uploads (idempotency check)

#### 4. Error Scenario Tests
**Scenarios to test:**
- Account disconnected (token revoked): Publish fails with REAUTH_REQUIRED
- Rate limit exceeded: 429 response, exponential backoff works
- Invalid privacy level: API rejects, fallback to SELF_ONLY
- Video URL inaccessible: TikTok can't download, fails with specific error
- Network timeout: Retry logic activates
- Malformed response: Parsing error captured, logged, user notified

#### 5. Load & Rate Limit Tests
**What:** Simulate multiple campaigns publishing simultaneously  
**How:** Queue 15 videos in rapid succession  
**Expected:** Rate limiter prevents exceeding 6 videos/minute quota

**Test:**
```typescript
it('should respect rate limits (6 videos/minute)', async () => {
  const startTime = Date.now();
  const results = [];
  
  // Queue 6 videos
  for (let i = 0; i < 6; i++) {
    results.push(publish(account, video));
  }
  
  // Should all complete within 60 seconds
  await Promise.all(results);
  const elapsed = Date.now() - startTime;
  expect(elapsed).toBeLessThan(61000); // 60s + grace period
  
  // 7th video should be queued/delayed
  const start7 = Date.now();
  await publish(account, video7);
  expect(Date.now() - start7).toBeGreaterThan(1000); // Waited at least 1s
});
```

### Monitoring & Observability

**Metrics to track:**
1. **Publish success rate:** (PUBLISH_COMPLETE) / (total attempted)
2. **Average publish time:** From init to status=PUBLISH_COMPLETE
3. **Retry count:** How many retries per successful publish
4. **Rate limit hits:** Number of 429 responses per day
5. **Auth failures:** REAUTH_REQUIRED events (user action needed)
6. **Content rejections:** fail_reason = "Content Policy Violation"

**Logging points:**
1. OAuth state created + consumed
2. Token refresh triggered + succeeded/failed
3. Publish initiated (include publish_id)
4. Status poll (include status, attempt number)
5. Publish completed (include external ID)
6. Publish failed (include error code + message)

**Alerts to configure (Sentry):**
1. Auth failures (email user to reconnect)
2. Rate limit exceeded 5x in a day (implementation issue)
3. Content rejection 2x in a row (account may be flagged)
4. Parsing errors (unexpected API response format)

---

## Section 9: Reusable Patterns from YouTube

### What Can Be Directly Reused

#### 1. OAuth Account Management
**Pattern:** `AccountsService` + `ConnectedAccountRecord`

**Directly reusable:**
- Token encryption/decryption (TokenCryptoService)
- Account persistence (database schema)
- Token refresh logic (`refreshAccessTokenIfNeeded()`)
- State token validation (CSRF protection)
- Multi-account support per user

**Minor adjustments:**
- TikTok OAuth endpoints (different URLs)
- TikTok scopes (different scope names)
- Provider-specific refresh logic (separate function per provider)

**Code reuse:** ~90% (only OAuth endpoints change)

#### 2. Campaign Target Model
**Pattern:** Campaign → Targets → Jobs

**Directly reusable:**
- `CampaignTarget` record structure
- `PublishJob` queue and status tracking
- Campaign status aggregation (pending/published/failed)
- Audit logging (who published what, when)

**Minor adjustments:**
- TikTok-specific fields (privacy_level, disable_comment, etc.)
- External ID field (YouTube: videoId, TikTok: publicly_available_post_id)

**Code reuse:** ~95% (schema fields added, logic unchanged)

#### 3. Upload Worker Pattern
**Pattern:** `YouTubeUploadWorker` → Abstract to generic worker

**Directly reusable:**
- Worker interface (processPickedJob, markFailed, markCompleted)
- Error classification (transient vs permanent)
- Audit events (publish_completed, publish_failed)
- Job retry logic
- Progress tracking

**Already done in codebase:** `TikTokUploadWorker` follows same pattern

**Code reuse:** ~80% (API calls different, overall structure identical)

#### 4. Error Classification
**Pattern:** `classifyPublishError()` returns 'transient' | 'permanent'

**Directly reusable:**
- Transient (retry): Network errors, timeouts, rate limits
- Permanent (don't retry): Invalid credentials, video rejected, wrong privacy level

**TikTok-specific errors:**
- Error 10001: Invalid access token → permanent (REAUTH_REQUIRED)
- Error 10002: Access token expired → transient (will refresh + retry)
- HTTP 429: Rate limited → transient (exponential backoff)
- fail_reason = "Content Policy": permanent (user must modify video)

**Code reuse:** ~70% (error codes differ, classification logic same)

#### 5. Campaign Execution Model
**Pattern:** `integrated-worker.ts` dispatches to platform-specific workers

**Directly reusable:**
- Job dispatcher (pick job, identify platform, route to worker)
- Retry scheduling (exponential backoff, max attempts)
- Campaign status aggregation
- Webhook notifications (when campaign complete)

**Code reuse:** ~95% (no changes needed, just register TikTok worker)

### What Must Change

#### 1. Video Upload Method
**YouTube:** Resumable upload (HTTP PUT chunks, with seek support)  
**TikTok:** Public URL download (HTTP GET from R2)

**Impact:** New upload function `tiktokDirectPostFromUrl()` vs `youtubeResumableUpload()`

#### 2. Account Targeting
**YouTube:** Channels (many per OAuth token)  
**TikTok:** Single account per token

**Impact:** UI change (select account, not channel); query parameters differ

#### 3. OAuth Endpoints & Scopes
**YouTube:** google.com/oauth2/authorize, scopes = youtube.*  
**TikTok:** tiktok.com/v1/oauth/authorize, scopes = video.*

**Impact:** New TikTokOauthService, already implemented in codebase

#### 4. API Polling vs Direct Response
**YouTube:** Synchronous, returns video ID immediately  
**TikTok:** Asynchronous, must poll for status

**Impact:** `waitForPublishCompletion()` loop in TikTok worker (already implemented)

#### 5. Metadata Handling
**YouTube:** Separate title, description, tags, playlist  
**TikTok:** Title only (includes hashtags), no separate description

**Impact:** Combine description + tags into title, truncate at 2,200 chars

---

## Section 10: Recommended Tech Stack

### Official APIs & Libraries

**TikTok SDK Options:**
1. **Recommendation: Raw HTTP + Auth.js**
   - Use official TikTok OAuth endpoints (documented, stable)
   - Use node-fetch or axios for HTTP calls
   - Reason: Simpler, fewer dependencies, full control

2. **Alternative: node-tiktok-sdk**
   - Wrapper around official API
   - Reduces boilerplate
   - Reason: If team wants abstraction layer

**OAuth Library:**
- **Auth.js (AuthJS):** Framework-agnostic OAuth provider
  - Already integrated for Google in codebase
  - TikTok provider available
  - Use for consistent OAuth pattern

### HTTP Client

**Current setup:** axios (used for YouTube Data API)  
**Recommendation:** Keep axios  
**Why:**
- Already in dependencies
- Timeout support (critical for rate limiting)
- Retry middleware available

**Code pattern:**
```typescript
const tiktokClient = axios.create({
  baseURL: 'https://open.tiktokapis.com/v1',
  timeout: 30000,
});

tiktokClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 429) {
      // Rate limiting handled by worker retry logic
    }
    throw error;
  }
);
```

### Database & ORM

**Current setup:** Prisma + PostgreSQL  
**No changes needed**  
**Schema updates:**
- Add `platform: 'youtube' | 'tiktok'` to CampaignTarget
- Add TikTok-specific fields (privacy_level, disable_comment, etc.)
- Existing ConnectedAccount schema supports TikTok

### Job Queue (Future: Bull/BullMQ)

**Current state:** Synchronous job processing (blocks on uploads)  
**Phase 2 scope:** Keep synchronous (acceptable for initial MVP)  
**Phase 2.1 (future):** Implement Bull/BullMQ for async publishing  
**Why needed:** Respects rate limits (6 videos/min), prevents simultaneous uploads

**Placeholder for future:**
```typescript
// Phase 2.1: Async queue
import { Queue } from 'bullmq';

const publishQueue = new Queue('tiktok-publish', {
  connection: redisConnection,
});

publishQueue.process(async (job) => {
  // Worker processes one job at a time
  // Rate limiting: Queue delays jobs to stay under 6/min
});
```

### Testing Framework

**Current setup:** Vitest  
**No changes needed**  
**Test files to add:**
- `tiktok-upload.worker.spec.ts` (unit tests for worker logic)
- `accounts.service.tiktok.spec.ts` (OAuth tests)
- `tiktok-integration.spec.ts` (end-to-end, sandbox)

### Error Tracking & Monitoring

**Current setup:** Sentry (Phase 1 decision)  
**Integration:** Already configured in `app.ts`  
**TikTok-specific:**
- Log all API errors with request/response
- Alert on content rejections
- Track rate limit hits

### Security Considerations

**Token Storage:** Encrypt all tokens (existing pattern, no changes)  
**OAuth State:** Validate state token, consume once (existing pattern)  
**HTTPS:** Required (public URLs must be HTTPS; already planned)  
**Rate Limiting:** Implement in queue (future work)  
**Webhook Validation:** N/A for initial launch (polling-based, not webhook-based)

### Deployment & Configuration

**Environment Variables (add to `.env.production`):**
```env
TIKTOK_CLIENT_ID=***
TIKTOK_CLIENT_SECRET=***
TIKTOK_OAUTH_REDIRECT_URI=https://app.example.com/accounts/oauth/tiktok/callback
```

**Feature Flags (optional):**
```typescript
const TIKTOK_PUBLISHING_ENABLED = process.env.TIKTOK_PUBLISHING_ENABLED === 'true';
```

**Rollout plan:**
1. Phase 2 Dev: Test with sandbox accounts
2. Phase 2 Staging: Real accounts, SELF_ONLY privacy (internal only)
3. Phase 2 Production: Open to users (feature flag = true)

---

## Conclusion: Key Planning Insights

### Top 5 Things to Know Before Building

1. **Use PULL_FROM_URL, not chunked upload**
   - Simpler (no sequencing logic)
   - Faster (parallel TikTok download)
   - Aligns with R2 storage (public URLs)

2. **Rate limits are hard: 6 videos/minute, 15/day per account**
   - Plan for queueing/job delay in Phase 2.1
   - MVP can handle 15 videos/day (sufficient)
   - Alert users when approaching daily limit

3. **OAuth token = one account (unlike YouTube's multi-channel)**
   - User must authenticate separately for each TikTok account
   - Campaign targets one account per target record
   - Same video can publish to multiple accounts (separate targets)

4. **Sandbox is adequate for testing, but limited**
   - 128 MB file size limit (test with <100 MB)
   - Draft only (can't verify public posting)
   - Test full flow: init → poll → error scenarios
   - Once approved, test with real account (SELF_ONLY privacy)

5. **Common integration issues are manageable**
   - Token expiration: Already handled by refreshAccessTokenIfNeeded()
   - Privacy level validation: Query creator info, present available options
   - Content rejection: Expect it, log fail_reason, educate users
   - All existing YouTube patterns (OAuth, workers, error classification) directly reusable

### Estimated Implementation Effort

- **OAuth flow:** 1-2 days (reuse AccountsService pattern)
- **Upload worker:** 1 day (reuse TikTokUploadWorker structure)
- **Campaign targeting UI:** 0.5 days (simple target selection)
- **Testing (sandbox + mocks):** 1-1.5 days
- **Deployment & monitoring:** 0.5 days
- **Contingency (debugging, edge cases):** 1 day

**Total:** ~5-6 days (aligns with roadmap estimate)

### Recommended Execution Order

1. **Day 1:** OAuth setup + TokenCryptoService integration
2. **Day 2:** Campaign targeting schema + UI
3. **Day 3:** TikTok upload worker (init + status polling)
4. **Day 4:** Sandbox testing + error scenarios
5. **Day 5:** Production approval request + monitoring setup
6. **Day 6:** Production launch + end-to-end verification

---

## References & Sources

### Official Documentation
- [TikTok Developer Portal](https://developers.tiktok.com/)
- [TikTok OAuth Authorization](https://developers.tiktok.com/doc/oauth-user-access-token-management)
- [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post)
- [TikTok API Rate Limits](https://developers.tiktok.com/doc/tiktok-api-v2-rate-limit)
- [TikTok Sandbox Mode](https://developers.tiktok.com/blog/introducing-sandbox)
- [TikTok Error Handling](https://developers.tiktok.com/doc/tiktok-api-v2-error-handling)
- [TikTok Video Media Transfer Guide](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide)

### Community & Guides
- [Integrating TikTok OAuth in Node.js](https://medium.com/@mayur.tanwani11/integrating-tiktok-login-and-utilizing-the-tiktok-api-in-our-react-and-node-js-app-using-oauth-2-0-31db6edf69df)
- [node-tiktok-sdk GitHub](https://github.com/sebastianobar/node-tiktok-sdk)
- [Auth.js TikTok Provider](https://authjs.dev/getting-started/providers/tiktok)
- [Scrapfly TikTok API Guide](https://scrapfly.io/blog/posts/guide-to-tiktok-api)
- [TikTok Video Upload Requirements](https://stackinfluence.com/tiktok-video-sizes-the-ultimate-2025-guide/)

### Related Project Resources
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [axios HTTP Client](https://axios-http.com/)
- [Prisma ORM](https://www.prisma.io/)
- [Vitest Testing Framework](https://vitest.dev/)

---

*Research completed: 2026-04-28*  
*Prepared for Phase 2 Planning*  
*Ready for Phase 2 Plan execution*
