# LIFEPLUS TV Score 리포트 생성

이 스킬을 실행하면 `data_MMDD.json`을 기반으로 TV Score 리포트 HTML을 생성한다.

---

## 0단계 — 데이터 파일 확인

`C:\Users\Administrator\Desktop\hanwha_ax_today\` 폴더에서 가장 최근 `data_MMDD.json` 파일을 찾아 읽는다.

파일명의 MMDD (예: `data_0624.json` → `0624`)를 출력 파일명에 사용한다.

---

## 1단계 — LTV Score 계산

### IP별 벤치마크 (기대값)

| IP | nat (자연유입%) | vr (조회율) | ctr | eff (반응효율) | sub (구독자증감) |
|----|---------------|------------|-----|--------------|----------------|
| 위클리S6 (w) | 0.317 | 0.184 | 0.0364 | 0.0074 | 180 |
| HOT&NEW (h) | 0.184 | 0.209 | 0.0379 | 0.0050 | 84 |
| 딥다이브 (d) | 0.209 | 0.171 | 0.0330 | 0.0057 | 97 |

### 정규화 함수

```
N(v, bench) = min(1.0, v / (bench × 2))
```

### LTV Score 공식

```
Base = N(nat) × 0.30
     + N(vr)  × 0.25
     + N(ctr) × 0.20
     + N(eff) × 0.15   (eff 데이터 없으면 0으로 처리)
     + N(sub) × 0.10

v2 = Base + 보너스 - 패널티
```

### 보너스/패널티 기준

| 항목 | 조건 | 값 |
|------|------|-----|
| b_org (자연유입 우수) | nat_pct_7d ≥ 0.30 | +0.05 |
| b_algo (알고리즘 유입) | nat_abs_7d / views_7d 비율이 높을수록 | 0~0.05 |
| b_srch (검색 유입) | 검색 비율이 높을수록 | 0~0.03 |
| pen (패널티) | CTR < 2%, sub < 0, vr < 10% 등 복합 기준 | -0.05~0 |

> eff 데이터가 JSON에 없으면 N(eff) = 0으로 계산하고, v2 옆에 `*eff미반영` 주석을 DATA 배열에 추가한다.

### 등급 기준

| 등급 | 조건 |
|------|------|
| S | v2 ≥ 0.70 |
| A | 0.50 ≤ v2 < 0.70 |
| B | 0.35 ≤ v2 < 0.50 |
| C | v2 < 0.35 |

---

## 2단계 — TV Score 리포트 생성

**출력 파일명**: `LIFEPLUS_TV_Score_MMDD_Report.html`

기존 `LIFEPLUS_TV_Score_0622_Report.html`을 기반으로 아래 항목을 갱신한다.

### 반드시 갱신할 항목

1. **`<title>` 태그**: `LIFEPLUS TV Score — MMDD Report`
2. **헤더 날짜/메타**: `MMDD 업데이트`, `집계완료 N편`, `신규 발행 대기 N편`
3. **DATA 배열**: JSON의 `episodes`를 LTV Score(v2) 내림차순으로 정렬하여 갱신
   - 기존 에피소드: 수치만 업데이트 (v2 재계산, 각 지표 갱신)
   - 신규 에피소드: v2 계산 후 적절한 위치에 삽입
4. **PENDING 배열**: JSON의 `pending` 항목으로 교체
5. **도넛 차트 데이터**: S/A/B/C 편수를 DATA 배열에서 계산하여 하드코딩
6. **IP 평균 LTV**: DATA 배열 기반으로 동적 계산 코드 유지 (하드코딩 금지)
7. **KPI 카드**: 채널 평균 LTV(DATA의 v2 평균), S+A / B / C / 신규 편수
8. **공식 섹션 배지**: 채널 평균 LTV 업데이트

### DATA 배열 필드 매핑 (JSON → HTML)

| HTML 필드 | JSON 필드 | 비고 |
|-----------|-----------|------|
| ip | ip | w/h/d |
| e | episode | 에피소드명 |
| v2 | 계산값 | LTV Score |
| v1 | 이전 v2 | 직전 리포트 기준 |
| nat | nat_pct_7d | 자연유입% |
| vr | vr_7d | 조회율 |
| ctr | ctr_7d | CTR |
| eff | eff_7d | 없으면 null |
| sub | sub_7d | 구독자증감 |
| watch | watch_min_7d | 평균시청시간(분) |
| ad | ad_pct_7d | 광고비중 |

---

## 3단계 — 검증 체크리스트

- [ ] 도넛 차트 S+A+B+C 합계 = DATA 배열 총 편수
- [ ] KPI 카드 편수 합계 = 집계완료 편수
- [ ] 헤더의 `집계완료 N편` = DATA 배열 실제 개수
- [ ] 채널 평균 LTV = DATA 배열 v2의 산술 평균 (소수점 2자리)
- [ ] 브라우저에서 정상 렌더링 확인 요청

---

## 참고: 파일 위치

```
C:\Users\Administrator\Desktop\hanwha_ax_today\
├── data_MMDD.json                         ← 입력 데이터
└── LIFEPLUS_TV_Score_MMDD_Report.html     ← 출력 리포트
```
