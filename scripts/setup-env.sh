#!/usr/bin/env bash
# scripts/setup-env.sh
#
# Interactive setup for CloneCraft production env vars.
# This script does NOT have access to your accounts — it just opens the
# dashboard pages in your browser and prompts you to paste each key/value.
# It then writes the result to .env (and prints nothing sensitive).
#
# Usage:  ./scripts/setup-env.sh
# Safe to re-run; existing keys are preserved unless you re-enter them.
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

# Sanity checks
[ -f "$ENV_FILE" ]     || { echo "❌ $ENV_FILE not found"; exit 1; }
[ -f "$EXAMPLE_FILE" ] || { echo "❌ $EXAMPLE_FILE not found"; exit 1; }

# Open a URL in the default browser (macOS). No-ops on other platforms.
open_browser() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  fi
}

# Read a value into a variable. If $1 is "secret", don't echo it.
prompt_value() {
  local var_name="$1"
  local label="$2"
  local current="$3"
  local mode="${4:-plain}"   # plain | secret

  echo
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $var_name"
  echo "  $label"
  if [ -n "$current" ]; then
    echo "  (current value present — leave blank to keep it)"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ "$mode" = "secret" ]; then
    read -r -s -p "  paste value (hidden): " val
    echo
  else
    read -r -p "  paste value: " val
  fi

  if [ -z "$val" ] && [ -n "$current" ]; then
    echo "  ↳ keeping existing value"
    return 0
  fi
  if [ -z "$val" ]; then
    echo "  ↳ skipped (empty)"
    return 0
  fi

  ESCAPED=$(printf '%s' "$val" | sed 's/[\/&]/\\&/g')
  if grep -qE "^${var_name}=" "$ENV_FILE"; then
    # Replace in place.
    sed -i.bak -E "s|^${var_name}=.*$|${var_name}=${ESCAPED}|" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    echo "${var_name}=${val}" >> "$ENV_FILE"
  fi
  echo "  ↳ written to .env"
}

echo "CloneCraft env setup"
echo "===================="
echo "This walks you through the dashboard pages you need to visit and"
echo "writes the keys/values into .env as you paste them."
echo
echo "Tip: open a second tab in your browser so you can copy/paste quickly."
echo

# ── Stripe ──────────────────────────────────────────────────────────────
echo
echo "── 1. STRIPE  (test mode keys)  ──"
open_browser "https://dashboard.stripe.com/test/apikeys"
prompt_value "STRIPE_SECRET_KEY"      "Stripe test secret key (sk_test_…). Dashboard → Developers → API keys." "" secret
prompt_value "STRIPE_PUBLISHABLE_KEY" "Stripe test publishable key (pk_test_…)." "" secret
echo
echo "When you wire the webhook (Phase 3), you'll also need a webhook"
echo "signing secret. The CLI does that for you: 'stripe listen --forward-to localhost:8787/api/webhooks/stripe'"
echo "and prints a whsec_… key. Skip for now — we'll add it then."

# ── Clerk ───────────────────────────────────────────────────────────────
echo
echo "── 2. CLERK  (auth)  ──"
open_browser "https://dashboard.clerk.com/"
prompt_value "VITE_CLERK_PUBLISHABLE_KEY" "Clerk publishable key (pk_test_…). API Keys → Show publishable key." "" secret
prompt_value "CLERK_SECRET_KEY"           "Clerk secret key (sk_test_…)." "" secret

# ── Sentry ──────────────────────────────────────────────────────────────
echo
echo "── 3. SENTRY  (error tracking)  ──"
open_browser "https://sentry.io/settings/projects/"
echo "  Create a project for each:"
echo "    - 'clonecraft-web' (React / Vite, browser SDK)"
echo "    - 'clonecraft-api' (Node / Hono, server SDK)"
echo "  Then for each project: Settings → Client Keys (DSN) → copy the DSN."
prompt_value "VITE_SENTRY_DSN" "Frontend DSN (e.g. https://…@o….ingest.sentry.io/…)." "" secret
prompt_value "SENTRY_DSN"      "Backend DSN."  "" secret

# ── Resend ──────────────────────────────────────────────────────────────
echo
echo "── 4. RESEND  (transactional email)  ──"
open_browser "https://resend.com/api-keys"
prompt_value "RESEND_API_KEY" "Resend API key (re_…)." "" secret
echo
echo "  You'll also need to verify a sending domain (clonecraft.dev?) in"
echo "  Resend before production. Skip for now — wire it in Phase 6."

# ── PostHog ─────────────────────────────────────────────────────────────
echo
echo "── 5. POSTHOG  (product analytics)  ──"
open_browser "https://app.posthog.com/project/settings"
prompt_value "VITE_POSTHOG_KEY"   "PostHog project API key (phc_…)." "" secret
prompt_value "VITE_POSTHOG_HOST"  "PostHog host (default: https://us.i.posthog.com)." "https://us.i.posthog.com" plain

# ── Final summary ───────────────────────────────────────────────────────
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done. Final .env keys (lengths only):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
awk -F'=' '
  /^[[:space:]]*#/ { next }
  /^[[:space:]]*$/ { next }
  {
    key=$1; sub(/^[[:space:]]*/,"",key); sub(/[[:space:]]*$/,"",key)
    val=$0; sub(/^[^=]*=/,"",val)
    printf "  %-30s <%d chars>\n", key, length(val)
  }
' "$ENV_FILE"
echo
echo "Note: .env is git-ignored. Never commit it."
