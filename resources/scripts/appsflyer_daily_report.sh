#!/usr/bin/env bash
# 트라이브앱 AppsFlyer daily_report(v5) 조회 스크립트 — 일자별 Installs/Loyal Users 등
# 사용법: ./appsflyer_daily_report.sh [FROM] [TO]
#   FROM/TO 형식 YYYY-MM-DD, 생략 시 최근 7일
#
# 필요한 것: 프로젝트 루트 .env 에 APPSFLYER_API_TOKEN=... (git-ignored 확인됨, 절대 커밋 금지)
#
# ⚠️ 중요(2026-09-09에 실측으로 확인): 이 엔드포인트는 앱당 하루 1회 호출 제한이 있음
# ("Limit reached for daily-report" HTTP 403). 절대 테스트용 짧은 range로 먼저 호출하지
# 말 것 — 처음부터 그날 필요한 전체 기간을 한 번에 요청할 것. 한도 리셋 주기는 달력일
# 기준으로 추정(미확인).
#
# partners_report(v5)와 달리 일자별로 행이 분해되어 나옴(daily 트렌드 확인용).
# 단, Organic 행은 Sessions=0으로 구조적으로 고정되어 나오는 게 API 자체의 한계로
# 확인됨(Installs/Loyal Users는 정상) — Sessions는 GA4와 비교하지 말 것.

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
  OUT="${OUTDIR}/appsflyer_daily_${APP}_${FROM}_${TO}.csv"
  curl -s -G "https://hq1.appsflyer.com/api/agg-data/export/app/${APP}/daily_report/v5" \
    --data-urlencode "from=${FROM}" \
    --data-urlencode "to=${TO}" \
    --data-urlencode "maximum_rows=1000" \
    -H "Authorization: Bearer ${APPSFLYER_API_TOKEN}" \
    -H "Accept: text/csv" \
    -o "$OUT"
  echo "saved: $OUT"
done
