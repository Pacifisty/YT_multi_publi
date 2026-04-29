#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-${PUBLIC_APP_URL:-http://127.0.0.1:3000}}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "OK: $*"
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    fail "$name is required"
  fi
  pass "$name is set"
}

check_http() {
  local label="$1"
  local url="$2"
  local expected_pattern="$3"
  local status

  status="$(curl -ksS -o /tmp/tiktok-smoke-body.txt -w "%{http_code}" "$url" || true)"
  if [[ ! "$status" =~ $expected_pattern ]]; then
    echo "Response body:" >&2
    sed -n '1,20p' /tmp/tiktok-smoke-body.txt >&2 || true
    fail "$label returned HTTP $status"
  fi
  pass "$label returned HTTP $status"
}

echo "TikTok smoke test against $BASE_URL"

require_env TIKTOK_CLIENT_KEY
require_env TIKTOK_CLIENT_SECRET
require_env TIKTOK_REDIRECT_URI
require_env PUBLIC_APP_URL
require_env OAUTH_TOKEN_KEY

if [[ "$TIKTOK_REDIRECT_URI" != https://* && "${ALLOW_INSECURE_TIKTOK_REDIRECT:-false}" != "true" ]]; then
  fail "TIKTOK_REDIRECT_URI must use HTTPS in production"
fi
pass "TikTok redirect URI scheme is acceptable"

if [[ "$PUBLIC_APP_URL" != https://* && "${ALLOW_INSECURE_PUBLIC_APP_URL:-false}" != "true" ]]; then
  fail "PUBLIC_APP_URL must use HTTPS for TikTok PULL_FROM_URL"
fi
pass "PUBLIC_APP_URL scheme is acceptable"

check_http "App root" "$BASE_URL/" "^(200|302|401|404)$"
check_http "TikTok OAuth start endpoint" "$BASE_URL/api/accounts/oauth/tiktok/start" "^(200|401|302)$"

if [[ -n "${SMOKE_TEST_PUBLIC_MEDIA_URL:-}" ]]; then
  check_http "Public media URL" "$SMOKE_TEST_PUBLIC_MEDIA_URL" "^(200|206)$"
fi

echo "TikTok smoke test completed"
