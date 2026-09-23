#!/usr/bin/env bash
# Deploys the public demo to Vercel from GitHub Actions (no Vercel Git integration needed):
# links or creates the project, sets the demo environment, deploys to production, then
# smoke-tests the public URL. Needs VERCEL_TOKEN and DATABASE_URL; PROJECT_NAME is optional.
set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}" "${DATABASE_URL:?DATABASE_URL is required}"
PROJECT_NAME="${PROJECT_NAME:-smashpoint-demo}"

# Pasted secrets often carry a trailing newline or spaces, and Neon's "Connect" dialog offers
# a `psql '<url>'` snippet: keep just the token / the connection URL.
VERCEL_TOKEN=$(printf '%s' "$VERCEL_TOKEN" | tr -d '[:space:]')
DB_URL=$(grep -oE "postgres(ql)?://[^'\"[:space:]]+" <<<"$DATABASE_URL" | head -n 1 || true)
if [[ -z $DB_URL ]]; then
  echo "::error::DATABASE_URL doesn't contain a postgres:// connection string. Copy the connection string from Neon (Connect → Connection string, pooling on) into the secret."
  exit 1
fi
DATABASE_URL=$DB_URL

echo "▶ Checking the Vercel token"
vget() { curl -sS -o "$2" -w '%{http_code}' -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com$1" || echo 000; }
err() { jq -c '.error // {}' "$1" 2>/dev/null || true; }
USER_CODE=$(vget /v2/user /tmp/vercel-user.json)
TEAMS_CODE=$(vget /v2/teams /tmp/vercel-teams.json)
TOKEN_CODE=$(vget /v5/user/tokens/current /tmp/vercel-token.json)
if [[ $USER_CODE == 200 ]]; then
  echo "  account: $(jq -r '.user.username // .user.email // "?"' /tmp/vercel-user.json)"
else
  echo "  /v2/user → HTTP $USER_CODE $(err /tmp/vercel-user.json)"
fi
if [[ $TEAMS_CODE == 200 ]]; then
  echo "  teams: $(jq -r '[.teams[]?.slug] | if length == 0 then "(none)" else join(", ") end' /tmp/vercel-teams.json)"
else
  echo "  /v2/teams → HTTP $TEAMS_CODE $(err /tmp/vercel-teams.json)"
fi
if [[ $TOKEN_CODE == 200 ]]; then
  # Token metadata only (type, origin, team scopes, expiry), never the token itself.
  echo "  token: $(jq -c '.token | {type, origin, expiresAt, scopes: [.scopes[]? | {type, teamId}]}' /tmp/vercel-token.json 2>/dev/null || true)"
else
  echo "  /v5/user/tokens/current → HTTP $TOKEN_CODE $(err /tmp/vercel-token.json)"
fi

# Deploy into: an explicit VERCEL_SCOPE (team slug or id), else the account's default team,
# else the team the token is limited to, else the first team it can list.
TEAM="${VERCEL_SCOPE:-}"
if [[ -z $TEAM && $USER_CODE == 200 ]]; then TEAM=$(jq -r '.user.defaultTeamId // empty' /tmp/vercel-user.json); fi
if [[ -z $TEAM && $TOKEN_CODE == 200 ]]; then TEAM=$(jq -r '[.token.scopes[]? | select(.type == "team") | .teamId][0] // empty' /tmp/vercel-token.json); fi
if [[ -z $TEAM && $TEAMS_CODE == 200 ]]; then TEAM=$(jq -r '.teams[0].id // empty' /tmp/vercel-teams.json); fi

if [[ $USER_CODE != 200 && -z $TEAM ]]; then
  reason=$(jq -r '.error.message // empty' /tmp/vercel-user.json 2>/dev/null || true)
  echo "::error::Vercel won't identify VERCEL_TOKEN${reason:+ ($reason)}, so it isn't a usable account token. Create one at https://vercel.com/account/settings/tokens (Scope: your Hobby team; Expiration: 30 or 90 days), copy it right away, and use it to update the VERCEL_TOKEN repository secret."
  exit 1
fi

SCOPE=""
if [[ -n $TEAM ]]; then
  SCOPE=$TEAM
  if [[ $TEAM == team_* ]]; then
    # The CLI's --scope wants the team slug: from the team list if we have it, else look it up.
    SLUG=""
    if [[ $TEAMS_CODE == 200 ]]; then SLUG=$(jq -r --arg id "$TEAM" '[.teams[]? | select(.id == $id) | .slug][0] // empty' /tmp/vercel-teams.json 2>/dev/null || true); fi
    if [[ -z $SLUG ]]; then
      code=$(vget "/v2/teams/$TEAM" /tmp/vercel-team.json)
      if [[ $code == 200 ]]; then SLUG=$(jq -r '.slug // empty' /tmp/vercel-team.json 2>/dev/null || true); else echo "  /v2/teams/$TEAM → HTTP $code $(err /tmp/vercel-team.json)"; fi
    fi
    SCOPE=${SLUG:-$TEAM}
  fi
fi
V=(vercel --token "$VERCEL_TOKEN")
if [[ -n $SCOPE ]]; then
  V+=(--scope "$SCOPE")
  echo "  deploying into team: $SCOPE"
fi

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
