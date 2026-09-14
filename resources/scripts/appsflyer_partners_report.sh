#!/usr/bin/env bash
# 트라이브앱 AppsFlyer partners_report(v5) 조회 스크립트
# 사용법: ./appsflyer_partners_report.sh [FROM] [TO]
#   FROM/TO 형식 YYYY-MM-DD, 생략 시 최근 7일
#
# 필요한 것: 프로젝트 루트 .env 에 APPSFLYER_API_TOKEN=... (git-ignored 확인됨, 절대 커밋 금지)
#
# 참고(2026-09-03, 2026-09-04 재확인):
#   Google Ads(googleadwords_int) / Facebook Ads 캠페인은 Impressions/Clicks/CTR/
#   Total Cost/ROI/Average eCPI 가 전부 문자열 "N/A" — 대시보드 Integrated Partners에서
#   비용 연동(Cost Integration) OAuth가 안 되어있는 상태. Total Revenue="0.0000"은 정상
#   (매출 자체가 0원)이라 N/A와 절대 같이 취급하면 안 됨.

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

# iOS: id1631958069 / Android: com.hanwha.lifeplus.tribes.app — 완전히 별개 앱이라 각각 호출 필요
for APP in "id1631958069" "com.hanwha.lifeplus.tribes.app"; do
  OUT="${OUTDIR}/appsflyer_${APP}_${FROM}_${TO}.csv"
  curl -s -G "https://hq1.appsflyer.com/api/agg-data/export/app/${APP}/partners_report/v5" \
    --data-urlencode "from=${FROM}" \
    --data-urlencode "to=${TO}" \
    --data-urlencode "maximum_rows=1000" \
    -H "Authorization: Bearer ${APPSFLYER_API_TOKEN}" \
    -H "Accept: text/csv" \
    -o "$OUT"
  echo "saved: $OUT"
done
