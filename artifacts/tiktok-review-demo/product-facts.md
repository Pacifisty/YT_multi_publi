# TikTok review demo — verified facts

Verified on 2026-10-20 against official TikTok for Developers documentation.

- App review requires at least one current end-to-end demo video. Up to five videos may be submitted, with a 50 MB limit for each file.
- A first review must demonstrate the integration through a Sandbox configuration.
- The recording must show the real web app, its user interactions, every selected TikTok product/scope, and the same domain supplied in the app configuration.
- The web Login Kit redirect URI must be an absolute HTTPS URI registered in the TikTok app configuration.
- `user.info.basic` is used to identify and display the connected TikTok account.
- This codebase implements Content Posting API Direct Post with `PULL_FROM_URL`; that flow requires `video.publish`.
- The codebase does not implement the separate Upload to TikTok/inbox flow, so it must not request `video.upload` or select that unused product for review.
- An unaudited Direct Post client is limited to private (`SELF_ONLY`) publication. The demo account must be private while testing.
- A `PULL_FROM_URL` source must come from a verified domain or URL prefix.

Official sources:

- https://developers.tiktok.com/doc/app-review-guidelines
- https://developers.tiktok.com/doc/login-kit-web
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/add-a-sandbox
- https://developers.tiktok.com/doc/content-sharing-guidelines
