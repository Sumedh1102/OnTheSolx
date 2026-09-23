#!/usr/bin/env bash
# Deploys the public demo to Vercel from GitHub Actions (no Vercel Git integration needed):
# links or creates the project, sets the demo environment, deploys to production, then
# smoke-tests the public URL. Needs VERCEL_TOKEN and DATABASE_URL; PROJECT_NAME is optional.
set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}" "${DATABASE_URL:?DATABASE_URL is required}"
PROJECT_NAME="${PROJECT_NAME:-smashpoint-demo}"
V=(vercel --token "$VERCEL_TOKEN")

echo "▶ Linking Vercel project '$PROJECT_NAME'"
if ! "${V[@]}" link --yes --project "$PROJECT_NAME" >/dev/null; then
  echo "  Not found; creating it"
  "${V[@]}" project add "$PROJECT_NAME"
  "${V[@]}" link --yes --project "$PROJECT_NAME" >/dev/null
fi
ORG_ID=$(jq -r .orgId .vercel/project.json)
PROJECT_ID=$(jq -r .projectId .vercel/project.json)
TEAM_QS=""
if [[ $ORG_ID == team_* ]]; then TEAM_QS="teamId=$ORG_ID"; fi

api() {
  local method=$1 path=$2 body=${3:-}
  local url="https://api.vercel.com$path"
  if [[ -n $TEAM_QS ]]; then
    if [[ $url == *\?* ]]; then url+="&$TEAM_QS"; else url+="?$TEAM_QS"; fi
  fi
  local args=(-sS --fail-with-body -X "$method" -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json")
  if [[ -n $body ]]; then args+=(--data "$body"); fi
  curl "${args[@]}" "$url"
}

echo "▶ Configuring environment variables"
EXISTING=$(api GET "/v9/projects/$PROJECT_ID/env" | jq -r '.envs[]?.key')
set_env() {
  api POST "/v10/projects/$PROJECT_ID/env?upsert=true" \
    "$(jq -nc --arg k "$1" --arg v "$2" '[{key: $k, value: $v, type: "encrypted", target: ["production", "preview"]}]')" >/dev/null
  echo "  set $1"
}
missing() { ! grep -qx "$1" <<<"$EXISTING"; }

set_env DATABASE_URL "$DATABASE_URL"
set_env DEMO_MODE true
set_env SEED_DEMO_DATA true
set_env PAYMENT_PROVIDER mock
# Generated once and then kept, so redeploys don't sign everyone out.
if missing AUTH_SECRET; then set_env AUTH_SECRET "$(openssl rand -base64 32)"; fi
if missing CRON_SECRET; then set_env CRON_SECRET "$(openssl rand -hex 24)"; fi

echo "▶ Deploying (built on Vercel; the build applies migrations and loads the demo data on first deploy)"
DEPLOY_URL=$("${V[@]}" deploy --prod --yes)
echo "  deployment: $DEPLOY_URL"

echo "▶ Finding the public domain"
DOMAIN=$(api GET "/v9/projects/$PROJECT_ID/domains" | jq -r '[.domains[]?.name] | sort_by(length) | first // empty')
if [[ -z $DOMAIN ]]; then DOMAIN=$(api GET "/v9/projects/$PROJECT_ID" | jq -r '.targets.production.alias[0] // empty'); fi
if [[ -z $DOMAIN ]]; then echo "Could not determine the production domain"; exit 1; fi
SITE="https://$DOMAIN"

echo "▶ Smoke-testing $SITE"
for i in $(seq 1 30); do
  if curl -fsS --max-time 20 "$SITE/api/health" 2>/dev/null | jq -e '.ok == true' >/dev/null 2>&1; then
    echo "  /api/health → ok"
    break
  fi
  if [[ $i == 30 ]]; then echo "Health check failed at $SITE/api/health"; exit 1; fi
  sleep 5
done
for path in / /book /coaching /login; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$SITE$path")
  echo "  $path → $code"
  if [[ $code != 200 ]]; then exit 1; fi
done

echo "✅ Live: $SITE"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  {
    echo "## SmashPoint demo is live"
    echo
    echo "**$SITE**"
    echo
    echo "One-click demo logins are on $SITE/login (password \`SmashPoint@123\`)."
  } >> "$GITHUB_STEP_SUMMARY"
fi
if [[ -n ${GITHUB_OUTPUT:-} ]]; then echo "url=$SITE" >> "$GITHUB_OUTPUT"; fi
echo "::notice title=Demo is live::$SITE"
