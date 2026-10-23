# TikTok app-review demo recording script

Target: 1920x1080 MP4 (H.264), 30 fps, 2–3 minutes, under 50 MB.

This must be a real screen recording of the Sandbox integration. Do not replace the TikTok authorization or publication result with mock screens.

## Before recording

- TikTok Sandbox selected in the Developer Portal.
- Login Kit and Content Posting API / Direct Post enabled.
- Requested scopes limited to `user.info.basic` and `video.publish`.
- Redirect URI registered exactly as `https://plataformmultipublisher.com/api/accounts/oauth/tiktok/callback`.
- Website/domain property verified for `https://plataformmultipublisher.com/`.
- The TikTok test account is added as a Sandbox target user and is private.
- `.env` contains the Sandbox Client Key and Client Secret and `TIKTOK_SANDBOX=true`.
- The app has been restarted and the public health check is successful.
- A short original MP4/H.264 test video is ready. It must not contain third-party branding or watermarks.
- Browser notifications, bookmarks with personal data, password-manager popups and unrelated tabs are hidden.

## Recording sequence

| Time | Screen/action | What the reviewer can verify |
|---|---|---|
| 00:00–00:08 | Show the browser address bar with `https://plataformmultipublisher.com`, then the public home page. | The recorded domain matches the submitted website. |
| 00:08–00:18 | Sign in with Google and open the workspace. | Entry into the actual web product. |
| 00:18–00:28 | Open **Contas** and click **Conectar TikTok**. | Where Login Kit is integrated. |
| 00:28–00:48 | On TikTok's real Sandbox authorization screen, show the app name and grant the displayed permissions. | Login Kit plus `user.info.basic` and `video.publish`. Do not reveal a password. |
| 00:48–01:00 | Return to the app and show the connected TikTok display name/avatar. | `user.info.basic` is used in the interface. |
| 01:00–01:20 | Open the publishing flow, select the original test video and select only the connected TikTok destination. | The user chooses the media and destination. |
| 01:20–01:42 | Fill in the caption and show TikTok privacy/interaction controls. Select `SELF_ONLY`. | Creator settings are visible and controlled by the user. |
| 01:42–01:52 | Review the summary and explicitly click the final publish/confirm button. | The app never publishes without user confirmation. |
| 01:52–02:18 | Show processing and then the completed publication status in the app. | Direct Post initialization and status polling complete end to end. |
| 02:18–02:35 | Open the private TikTok account/post and show the new private test post, without exposing personal data. | The content reached TikTok through the Sandbox integration. |
| 02:35–02:45 | Return to the connected-account or campaign status screen. | Stable final state and connection to the originating workflow. |

## Optional on-screen captions

1. `Official website: plataformmultipublisher.com`
2. `TikTok Login Kit — Sandbox target user`
3. `Scope: user.info.basic — connected account identity`
4. `Scope: video.publish — Direct Post with explicit user confirmation`
5. `Unaudited Sandbox publication uses SELF_ONLY visibility`
6. `Publication completed`

## Export check

- Container: MP4
- Video: H.264, 1920x1080, 30 fps
- Audio: AAC if narration is present; silence is acceptable for a clearly captioned review demo
- Target bitrate: about 2 Mb/s for a 2–3 minute recording
- Maximum file size: 50 MB
- Watch the entire exported file once and confirm that no password, token, secret, email address or unrelated personal data is visible.
