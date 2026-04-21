#!/usr/bin/env bash
# AppsFlyer 엔드포인트 진단 — 어떤 URL 조합이 200을 주는지 찾는다.
# 사용: APPSFLYER_DEV_TOKEN=... APPSFLYER_APP_ID=... ./scripts/af-diagnose.sh

set -e

if [ -f .env.local ]; then
  # shellcheck disable=SC1091
  export $(grep -v '^#' .env.local | xargs)
fi

TOKEN="${APPSFLYER_DEV_TOKEN:?APPSFLYER_DEV_TOKEN missing}"
APP="${APPSFLYER_APP_ID:-com.makealive.PKMergeA}"
TO=$(date -u +%Y-%m-%d)
FROM=$(date -u -v-7d +%Y-%m-%d 2>/dev/null || date -u -d '7 days ago' +%Y-%m-%d)

echo "token head: ${TOKEN:0:6}... len=${#TOKEN}"
echo "app: $APP"
echo "window: $FROM → $TO"
echo ""

probe() {
  local name=$1
  local method=$2
  local url=$3
  local auth=$4
  local body=$5
  local tmp
  tmp=$(mktemp)
  local status
  if [ "$method" = "POST" ]; then
    status=$(curl -s -o "$tmp" -w "%{http_code}" -X POST "$url" \
      -H "$auth" -H "Content-Type: application/json" -d "$body")
  else
    status=$(curl -s -o "$tmp" -w "%{http_code}" "$url" -H "$auth")
  fi
  printf "[%-3s] %-45s → %s\n" "$status" "$name" "$(head -c 80 "$tmp" | tr '\n' ' ')"
  rm -f "$tmp"
}

echo "=== Master API (v4 Aggregate, Bearer) ==="
probe "master v4 daily_report" GET \
  "https://hq1.appsflyer.com/api/master-agg-data/v4/app/${APP}/daily_report?from=${FROM}&to=${TO}&kpis=installs&format=json" \
  "Authorization: Bearer ${TOKEN}"

probe "master v4 partners_report" GET \
  "https://hq1.appsflyer.com/api/master-agg-data/v4/app/${APP}/partners_report?from=${FROM}&to=${TO}&kpis=installs&format=json" \
  "Authorization: Bearer ${TOKEN}"

echo ""
echo "=== Pull API v5 (raw-data/export, Bearer) ==="
# 공식 경로: /api/raw-data/export/app/{app_id}/{report-type}/v5
probe "pull installs_report v5 (correct path)" GET \
  "https://hq1.appsflyer.com/api/raw-data/export/app/${APP}/installs_report/v5?from=${FROM}&to=${TO}" \
  "Authorization: Bearer ${TOKEN}"

probe "pull in_app_events_report v5" GET \
  "https://hq1.appsflyer.com/api/raw-data/export/app/${APP}/in_app_events_report/v5?from=${FROM}&to=${TO}" \
  "Authorization: Bearer ${TOKEN}"

probe "pull organic_installs v5" GET \
  "https://hq1.appsflyer.com/api/raw-data/export/app/${APP}/organic_installs_report/v5?from=${FROM}&to=${TO}" \
  "Authorization: Bearer ${TOKEN}"

echo ""
echo "=== legacy /export path (v1-era, api_token query) ==="
probe "legacy /export installs" GET \
  "https://hq1.appsflyer.com/export/${APP}/installs_report/v5?api_token=${TOKEN}&from=${FROM}&to=${TO}" \
  "Accept: text/csv"

echo ""
echo "=== Cohort API (v1, Bearer POST) ==="
probe "cohort v1" POST \
  "https://hq1.appsflyer.com/api/cohorts/v1/data/app/${APP}" \
  "Authorization: Bearer ${TOKEN}" \
  "{\"cohort_type\":\"user_acquisition\",\"from\":\"${FROM}\",\"to\":\"${TO}\",\"aggregation_type\":\"on_day\",\"groupings\":[\"pid\"],\"kpis\":[\"users\"]}"

echo ""
echo "=== Account self-check ==="
probe "OpenAPI /me (v2 token validation)" GET \
  "https://hq1.appsflyer.com/api/openapi/auth/v2/me" \
  "Authorization: Bearer ${TOKEN}"

probe "Agencies/Partners list" GET \
  "https://hq1.appsflyer.com/api/mng/app" \
  "Authorization: Bearer ${TOKEN}"

echo ""
echo "진단 완료. 200/201/2xx 응답이 있는 엔드포인트를 fetcher.ts에 반영하면 됩니다."
