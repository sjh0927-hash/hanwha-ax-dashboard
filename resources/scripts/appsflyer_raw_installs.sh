#!/usr/bin/env bash
# 트라이브앱 AppsFlyer raw-data installs_report(v5) 조회 스크립트 — 애드셋 단위 breakdown용
# 사용법: ./appsflyer_raw_installs.sh [FROM] [TO]
#   FROM/TO 형식 YYYY-MM-DD, 생략 시 최근 7일
#
# 필요한 것: 프로젝트 루트 .env 에 APPSFLYER_API_TOKEN=... (git-ignored 확인됨, 절대 커밋 금지)
#
# ⚠️ 이 raw-data 엔드포인트는 hq1.appsflyer.com에 요청하면 302로
# rawdata.appsflyer.com/export/token/{token}으로 리다이렉트되는 2단계 구조 —
# 이 환경(Windows curl+schannel)에서 두 번째 도메인 접속 시 CRYPT_E_REVOCATION_OFFLINE으로
# 끊기므로 --ssl-revoke-best-effort 필수(2026-09-11 실측 확인). maximum_rows를 너무
# 작게 주면 "Invalid limit value" 400 에러 나므로 넉넉하게(기본 50000) 사용.
#
# ⚠️ PII 주의: 응답에 AppsFlyer ID/GAID/IDFA/Android ID/IP/User Agent 등 기기 식별자가
# 원본 그대로 들어있음 — resources/data/에 저장 후 절대 커밋하지 말 것(.gitignore 커버됨).
#
# Adset/Adset ID 컬럼 파악용 — 집계 API(partners_report/daily_report)는 애드셋 차원이
# 없어서 이 raw 엔드포인트가 유일한 방법(단, "설치" 이벤트 단위만 가능, 활성사용자/세션
# 개념은 raw 데이터에 없음). Facebook Ads는 실제 애드셋명이 나오나 Google UAC는 자동생성
# 코드만 나옴(둘 다 구조적 한계, 2026-09-11 확인).

set -euo pipefail
cd "$(dirname "$0")/../.."  # 프로젝트 루트로 이동해서 .env 로드

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "${APPSFLYER_API_TOKEN:-}" ]; then
  echo "ERROR: APPSFLYER_API_TOKEN 이 .env 에 없습니다." >&2
  exit 1
fi

TO="${2:-$(date +%Y-%m-%d)}"
FROM="${1:-$(date -d "$TO -6 days" +%Y-%m-%d 2>/dev/null || date -j -v-6d -f %Y-%m-%d "$TO" +%Y-%m-%d)}"

OUTDIR="${AF_OUTDIR:-resources/data/appsflyer}"
mkdir -p "$OUTDIR"

for APP in "id1631958069" "com.hanwha.lifeplus.tribes.app"; do
  OUT="${OUTDIR}/raw_installs_${APP}_${FROM}_${TO}.csv"
  curl -s -L --ssl-revoke-best-effort -G "https://hq1.appsflyer.com/api/raw-data/export/app/${APP}/installs_report/v5" \
    --data-urlencode "from=${FROM}" \
    --data-urlencode "to=${TO}" \
    --data-urlencode "maximum_rows=50000" \
    -H "Authorization: Bearer ${APPSFLYER_API_TOKEN}" \
    -H "Accept: text/csv" \
    -o "$OUT"
  echo "saved: $OUT"
done
