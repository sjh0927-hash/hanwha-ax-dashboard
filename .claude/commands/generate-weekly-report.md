# LIFEPLUS 주간 리포트 생성

이 스킬을 실행하면 `data_MMDD.json`을 기반으로 주간 리포트 HTML을 생성한다.

---

## 0단계 — 데이터 파일 확인

`C:\Users\Administrator\Desktop\hanwha_ax_today\` 폴더에서 가장 최근 `data_MMDD.json` 파일을 찾아 읽는다.

`channel_kpi` 섹션의 값이 0이거나 기본값(`"W__"`, `"YYYY.MM.DD"`)이면, 사용자에게 아래 항목을 요청한다:

- 이번 주 라벨 (예: W26)
- 집계 기간 (예: 2026.06.21–06.27)
- 채널 전체 구독자 수 (누적)
- 이번 주 구독자 증감
- 채널 전체 주간 조회수
- 연간 누적 조회수
- HIT 달성 에피소드 수 (누적)

---

## 1단계 — 주간 리포트 생성

**출력 파일명**: `LIFEPLUS_weekly_report_WXX_N.html` (예: `W26_1`)

기존 `LIFEPLUS_weekly_report_W25_4.html`을 템플릿으로 활용한다.

### 반드시 갱신할 항목

1. **헤더 KPI**:
   - 구독자 증감: `channel_kpi.subscribers_weekly`
   - 주간 조회수: `channel_kpi.views_weekly_total`
   - 발행 편수: 이번 주 발행 에피소드 수
   - 평균 CTR: 이번 주 발행 에피소드들의 CTR 평균
   - 누적 조회수: `channel_kpi.views_ytd_total`

2. **연간 목표 달성현황**:
   - 구독자: `subscribers_total / 1,100,000`
   - 조회수: `views_ytd_total / 60,000,000`
   - HIT: `hit_count / 12`

3. **이번 주 발행 에피소드**: JSON `pending`(status=collecting) + 최근 7일 내 `episodes`
   - 1D 집계 중인 에피소드: 1D 지표 사용
   - 7D 집계 완료된 에피소드: 7D 지표 사용

4. **IP별 성과 비교**: 최근 에피소드 기준 7D 지표

5. **BEST/WORST 분석**:
   - BEST: 조회수 기준 상위 에피소드
   - WORST: 조회수 기준 하위 에피소드

6. **다음 주 발행 예정**: `pending` 중 status=`pending`인 에피소드

---

## 2단계 — 검증 체크리스트

- [ ] 헤더 구독자 증감 = `channel_kpi.subscribers_weekly`
- [ ] 연간 달성률 % 계산 정확성 (구독자·조회수·HIT 각각)
- [ ] 시청시간 표기 = `watch_h × 60 / views` (소수점 1자리)
- [ ] 이번 주 에피소드 수 = 헤더 발행 편수와 일치
- [ ] 브라우저에서 정상 렌더링 확인 요청

---

## 참고: 파일 위치

```
C:\Users\Administrator\Desktop\hanwha_ax_today\
├── data_MMDD.json                           ← 입력 데이터
└── LIFEPLUS_weekly_report_WXX_N.html        ← 출력 리포트
```
