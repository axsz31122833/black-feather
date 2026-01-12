#!/usr/bin/env bash
set -e
MSG="${1:-chore: deploy}"
BRANCH="${BRANCH:-main}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "$MSG"
fi
git push origin "$BRANCH"
cd "$ROOT/scripts"
npm ci
npm run build
cd "$ROOT"
if [ -n "$VERCEL_TOKEN" ]; then
  npx vercel link --project black_feather --scope feng-jias-projects --yes >/dev/null 2>&1 || true
  npx vercel build --yes --scope feng-jias-projects --token "$VERCEL_TOKEN"
  npx vercel deploy --prod --prebuilt --yes --scope feng-jias-projects --token "$VERCEL_TOKEN"
elif [ -n "$DEPLOY_HOOK_URL" ]; then
  curl -s -X POST "$DEPLOY_HOOK_URL" >/dev/null
else
  echo "Set VERCEL_TOKEN or DEPLOY_HOOK_URL" >&2
  exit 1
fi
