# 라플TV 캠페인 대시보드 데일리 업데이트

이 스킬을 실행하면 최신 엑셀 보고서를 읽어 `라플TV_캠페인_대시보드.html`을 업데이트한다.

---

## 핵심 개념: 1일 오프셋

엑셀의 날짜 = 광고 데이터 보고 기준일 (= 실제 광고 집행일 + 1일)  
HTML 레이블 = 실제 광고 집행일

따라서: **HTML '6/N' = Excel (N+1)일 행**

예) 엑셀 6월 25일(46197) 행 → HTML `'6/24'` 레이블로 입력

---

## ⚠️ 필수 주의사항

### replace_all 사용 절대 금지

HTML 내 `var data=[{lbl:'6/XX',...}]` 패턴이 여러 차트에 동시에 존재한다.  
`replace_all`로 날짜 배열을 교체하면 **의도하지 않은 다른 차트 데이터도 함께 덮어써진다**.

예: 전환 롤링 7일 차트(`cv1`)와 클릭최대화 프로그램별 차트(`clickProg`)가 동일 패턴 공유  
→ `replace_all` 시 `clickProg` 데이터가 전환 데이터로 교체됨 → `d.c` 속성 없음 → 차트 미표시

**항상 충분한 주변 컨텍스트로 단건 교체(replace_all:false)할 것.**

### CC 객체 새 날짜 추가 시 버그 주의

CC 객체(`전환 소재별`)에 새 날짜를 추가할 때, **직전 날짜 값이 그대로 복사되는 버그**가 발생한 이력이 있다.  
새 날짜 추가 후 반드시 직전 날짜 값과 비교 검증할 것 (군체/토이스토리/스필버그 3개 소재 모두).

---

## 0단계 — 파일 확인

작업 디렉토리: 현재 Claude Code 작업 디렉토리 (`$pwd`)

**대시보드 파일**: `라플TV_캠페인_대시보드.html`

**최신 엑셀 보고서**: 아래 PowerShell로 자동 감지한다.

```powershell
$projRoot = (Get-Location).Path
Get-ChildItem $projRoot -Filter "차이_한화_라이프플러스_라플TV_Report_*.xlsx" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
```

파일명의 날짜(예: `260625` = 2026년 06월 25일)를 확인해 **보고서 기준일**을 파악한다.  
HTML에 표시할 날짜 = 보고서 기준일 - 1일 (예: `6/24`).

**엑셀 비밀번호**: 팀 내부 공유 비밀번호 사용 (`$xlPassword` 변수로 전달, 기본값 `"1234"`)

---

## 1단계 — 현재 HTML 최신 날짜 확인

HTML에서 각 객체의 마지막 날짜 항목을 Grep으로 확인한다.

```
var JUNE = { ... '6/XX':[ ... ]}   → 클릭최대화 소재별 마지막 날짜
var RD = { ... '6/XX':{ ... }}     → 후속조회 일별 마지막 날짜
var RC = { ... '6/XX':[ ... ]}     → 후속조회 소재별 마지막 날짜
var CONV = { ... '6/XX':{ ... }}   → 전환 일별 마지막 날짜
var CC = { ... '6/XX':[ ... ]}     → 전환 소재별 마지막 날짜
```

**업데이트 필요 범위**: 마지막 HTML 날짜 다음 날부터 `(보고서기준일 - 1일)`까지

---

## 2단계 — 엑셀 전체 데이터 추출

아래 PowerShell 패턴으로 **단일 명령**에서 모든 시트를 읽는다 (세션 분리 불가).

```powershell
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false
$xlPassword = "1234"   # 팀 내부 비밀번호로 교체
$wb = $xl.Workbooks.Open($xlPath, 0, $true, 5, $xlPassword)

$wsTotal   = $wb.Sheets.Item("Grand total")
$wsClick   = $wb.Sheets.Item("디맨드젠_클릭최대화")
$wsRetgt   = $wb.Sheets.Item("디맨드젠_후속조회")
$wsConv    = $wb.Sheets.Item("디맨드젠_전환캠페인")
$wsHot     = $wb.Sheets.Item("HOT & NEW_조회")
$wsWeekly  = $wb.Sheets.Item("라플위클리_조회")
$wsDeep    = $wb.Sheets.Item("딥다이브_조회")

# ... 아래 단계별로 데이터 읽기 ...

$wb.Close($false); $xl.Quit()
```

### 엑셀 날짜 시리얼 → 실제 날짜 변환
- 46173 = 2026년 6월 1일 (일)
- 46196 = 2026년 6월 24일 (화)
- 계산: `날짜 = 46173 + (실제일 - 1)`

---

## 3단계 — KPI 박스 업데이트 (5개 탭 전체)

> 각 탭 상단의 성과 요약 박스. 엑셀 **6월합계 행**에서 읽는다. 매일 전체 갱신.

### 엑셀 6월합계 행 위치 (확인됨)

| 시트 | 6월합계 행 | 주요 열 |
|------|-----------|---------|
| 디맨드젠_후속조회 (일별총합) | R19 | C4=비용, C5=노출, C6=조회, C7=클릭, C9=CTR |
| 디맨드젠_후속조회 (소재별) | R55 | C4=토이스토리비용, C14=실수비용, C24=스필버그비용 |
| 디맨드젠_전환캠페인 (일별총합) | R184 | C4=비용, C5=노출, C6=조회, C7=클릭, C9=CTR, C12=전환건수, C13=CVR |
| 디맨드젠_전환캠페인 (소재별) | R377 | C4=군체비용, C14=스필버그비용, C24=토이스토리비용 |
| 디맨드젠_클릭최대화 (소재별) | R104 | C4=스필버그비용, C5=노출, C6=조회, C7=클릭, C9=CTR, C10=CPC |
|  | | C14=토이스토리비용, C15=노출, C16=조회, C17=클릭, C19=CTR, C20=CPC |
|  | | C24=HOT&NEW비용, C25=노출, C26=조회, C27=클릭, C29=CTR, C30=CPC |
| Grand total | R16 (유튜브 subtotal) | C6=노출, C7=조회, C8=클릭, C12=소진금액(VAT+) |

### 예산 고정값

| 캠페인 | 예산 |
|--------|------|
| 조회캠페인 (유튜브만) | 3,983만원 |
| 클릭최대화 | 1,000만원 |
| 후속조회 | 1,000만원 |
| 전환 | 1,000만원 |
| **전체** | **6,983만원** |

---

### 3-1. 개요 탭 KPI

**HTML 위치**: `id="page-overview"` → 첫 번째 `.kpi-grid` (6개 박스)

**데이터 소스**: 4개 캠페인 KPI 합산

```
총 광고비 = 조회집행액 + 클릭집행액 + 후속집행액 + 전환집행액  (만원단위)
소진율 = round(총광고비 / 6983 * 100)%
총 노출 = Grand total R16 C6
총 조회 = Grand total R16 C7
총 클릭 = Grand total R16 C8
CTR = round(총클릭/총노출*100, 2)%
CPV = round(총광고비×10000/총조회)원
CPC = round(총광고비×10000/총클릭)원
전환 = $wsConv.Cells(184,12)건
구독단가 = round($wsConv.Cells(184,4)/$wsConv.Cells(184,12))원
```

**HTML 업데이트 대상** (class="kpi a/t" 박스):
```html
<div class="kpi a">총광고비만원 / 예산 6,983만 · X% 소진</div>
<div class="kpi">총노출만회 / X,XXX,XXX회</div>
<div class="kpi t">총조회만 / X,XXX,XXX회</div>
<div class="kpi t">X.XX% CTR / 클릭 XXX,XXX</div>
<div class="kpi">CPV XX원 / CPC XXX원</div>
<div class="kpi t">X,XXX건 전환 / 단가 X,XXX원</div>
```

---

### 3-2. 조회캠페인 탭 KPI

**HTML 위치**: `id="page-view"` → `.kpi-grid` (5개 박스)

**데이터 소스**: HOT&NEW_조회 + 라플위클리_조회 + 딥다이브_조회 시트 6월합계 합산

**컬러 클래스 규칙**:
- 소진금액 → `kpi a` (orange)
- 총 조회수 → `kpi t` (teal)
- 평균 CPV → `kpi t` (teal)

---

### 3-3. 클릭최대화 탭 KPI

**HTML 위치**: `id="page-click"` → `.kpi-grid` (6개 박스)

**데이터 소스**: `$wsClick` R104 소재별 6월합계 합산

```powershell
$ck_cost  = $wsClick.Cells(104,4)  + $wsClick.Cells(104,14) + $wsClick.Cells(104,24)  # 총 소진금액
$ck_imp   = $wsClick.Cells(104,5)  + $wsClick.Cells(104,15) + $wsClick.Cells(104,25)  # 총 노출
$ck_views = $wsClick.Cells(104,6)  + $wsClick.Cells(104,16) + $wsClick.Cells(104,26)  # 총 조회
$ck_click = $wsClick.Cells(104,7)  + $wsClick.Cells(104,17) + $wsClick.Cells(104,27)  # 총 클릭
$ck_ctr   = [Math]::Round($ck_click / $ck_imp * 100, 2)                               # CTR
$ck_cpc   = [Math]::Round($ck_cost / $ck_click)                                        # CPC
$ck_cpv   = [Math]::Round($ck_cost / $ck_views)                                        # CPV
$ck_pct   = [Math]::Round($ck_cost / 100000000 * 100)                                  # 소진율(%)
```

**컬러 클래스 규칙**:
- 6월 집행액 → `kpi a` (orange)
- 총 클릭수 → `kpi t` (teal)
- 평균 CPC → `kpi a` (orange)
- 총 조회수 → `kpi t` (teal)

---

### 3-4. 후속조회 탭 KPI

**HTML 위치**: `id="page-retarget"` → `.kpi-grid` (5개 박스)  
**레이블**: `후속 조회 캠페인 · 6월 성과 (6/1~6/N)`

**데이터 소스**: `$wsRetgt` R19 (일별총합 6월합계)

```powershell
$rt_cost  = $wsRetgt.Cells(19,4)                                # 총 소진금액
$rt_imp   = $wsRetgt.Cells(19,5)                                # 총 노출
$rt_views = $wsRetgt.Cells(19,6)                                # 총 조회
$rt_click = $wsRetgt.Cells(19,7)                                # 총 클릭
$rt_ctr   = [Math]::Round($wsRetgt.Cells(19,9)*100, 2)          # CTR
$rt_cpv   = [Math]::Round($rt_cost / $rt_views)                 # CPV
$rt_cpc   = [Math]::Round($rt_cost / $rt_click)                 # CPC
$rt_pct   = [Math]::Round($rt_cost / 100000000 * 100)           # 소진율(%)
$rt_costM = [Math]::Round($rt_cost / 10000)                     # 만원
```

**HTML 업데이트 대상**:
```html
<div class="kpi a">Xman원 / 예산 1,000만 · X% 소진</div>
<div class="kpi">XXX만 / X,XXX,XXX회</div>          ← 총 노출수
<div class="kpi t">X,XXX,XXX / CTR X.XX%</div>       ← 총 조회수 (kpi t)
<div class="kpi t">XX원 / 3개 캠페인 운영 중</div>    ← 평균 CPV (kpi t)
<div class="kpi">XX,XXX / CPC XXX원</div>            ← 클릭수
```

---

### 3-5. 전환 탭 KPI

**HTML 위치**: `id="page-conv"` → `.kpi-grid` (5개 박스)

**데이터 소스**: `$wsConv` R184 (일별총합 6월합계)

```powershell
$cv_cost  = $wsConv.Cells(184,4)                                # 총 소진금액
$cv_imp   = $wsConv.Cells(184,5)                                # 총 노출
$cv_views = $wsConv.Cells(184,6)                                # 총 조회
$cv_click = $wsConv.Cells(184,7)                                # 총 클릭
$cv_ctr   = [Math]::Round($wsConv.Cells(184,9)*100, 2)          # CTR
$cv_conv  = [Math]::Round($wsConv.Cells(184,12))                # 전환건수
$cv_cvr   = [Math]::Round($wsConv.Cells(184,13)*100, 1)         # CVR(%)
$cv_cpsub = [Math]::Round($cv_cost / $cv_conv)                  # 구독단가
$cv_pct   = [Math]::Round($cv_cost / 100000000 * 100)           # 소진율(%)
$cv_costM = [Math]::Round($cv_cost / 10000)                     # 만원
```

**컬러 클래스 규칙**:
- 전환건수 → `kpi t` (teal)
- 구독단가 → `kpi a` (orange)
- 6월 광고비 → `kpi a` (orange)
- CTR → `kpi t` (teal)
- CVR → `kpi t` (teal)

---

## 4단계 — 개요 탭 camp-list 업데이트

**HTML 위치**: `id="page-overview"` → `.camp-list` → 4개 `.camp` 블록

각 캠페인 행에서 업데이트할 값:

| 캠페인 | 소진율 | 집행액 | 지표1 | 지표2 | 지표3 |
|--------|--------|--------|-------|-------|-------|
| 조회캠페인 | 조회집행액/3983% | 조회집행액만원 | CTR | CPV | 조회수 |
| 클릭최대화 | `$ck_pct`% | `$ck_costM`만원 | `$ck_ctr`% CTR | CPC | `$ck_click` 클릭 |
| 후속조회 | `$rt_pct`% | `$rt_costM`만원 | `$rt_ctr`% CTR | CPV | `$rt_views` 조회 |
| 전환 | `$cv_pct`% | `$cv_costM`만원 | `$cv_ctr`% CTR | `$cv_cpsub`원 구독단가 | `$cv_conv` 전환 |

**HTML 패턴** (각 camp 블록):
```html
<span style="color:var(--accent)">X% 소진 · Xman원</span>
<div class="pf" style="width:X%"></div>   ← progress bar width = 소진율%
<div class="cmv">X.XX%</div>             ← CTR
<div class="cmv">XX원</div>              ← CPC 또는 CPV
<div class="cmv">XX,XXX</div>            ← 클릭 또는 조회 또는 전환
```

---

## 5단계 — 클릭최대화 프로그램 카드 업데이트

**HTML 위치**: `id="page-click"` → `.prog-card` 3개 (라플위클리, HOT&NEW, 딥다이브)

**데이터 소스**: `$wsClick` R104 소재별 6월합계

```powershell
# 라플위클리 카드 (스필버그 C2~C11 + 토이스토리 C12~C21 합산)
$wk_cost  = $wsClick.Cells(104,4)  + $wsClick.Cells(104,14)
$wk_imp   = $wsClick.Cells(104,5)  + $wsClick.Cells(104,15)
$wk_views = $wsClick.Cells(104,6)  + $wsClick.Cells(104,16)
$wk_click = $wsClick.Cells(104,7)  + $wsClick.Cells(104,17)
$wk_ctr   = [Math]::Round($wk_click/$wk_imp*100, 2)
$wk_cpc   = [Math]::Round($wk_cost/$wk_click)

# HOT&NEW 카드 (C22~C31)
$hn_cost  = $wsClick.Cells(104,24)
$hn_imp   = $wsClick.Cells(104,25)
$hn_views = $wsClick.Cells(104,26)
$hn_click = $wsClick.Cells(104,27)
$hn_ctr   = [Math]::Round($wsClick.Cells(104,29)*100, 2)
$hn_cpc   = [Math]::Round($hn_cost/$hn_click)

# 딥다이브 카드: R104에서 열 위치 확인 필요 (C32~C41 추정)
# → R102 헤더 행에서 4번째 소재 그룹 열 확인 후 사용
```

각 카드의 업데이트 항목: 집행액, 노출, 조회, 클릭, CTR, CPC

**배지(badge) 규칙**:
- CTR 최고 소재: `class="badge bg"` (파란 배지)
- CPC 최저 소재: `class="badge bg"` (파란 배지)
- 그 외: `class="badge ba"` (회색 배지)

---

## 5-1단계 — 광고비/클릭수 도넛 차트 소재 데이터 업데이트

**HTML 위치**: `id="page-click"` → `<canvas id="clickDonutCost">`, `<canvas id="clickDonutClicks">`  
**JS 위치**: `drawDonut('clickDonutCost', [...])`, `drawDonut('clickDonutClicks', [...])`

**데이터 소스**: `$wsClick` 소재별 6월합계 행(R104) — 소재별 비용/클릭수

> ⚠️ **중앙 수치 하드코딩 금지** — `drawDonut(canvasId, slices, centerSub, fmt)`는 중앙에 표시되는 총계(예: `945만원`, `23.9만`)를 **slices 배열의 `v` 합계에서 자동 계산**한다 (`fmt` 콜백으로 단위만 지정).  
> 과거 이 값을 문자열로 직접 써넣다가(`'945만원'`처럼) 소재별 `v` 값은 갱신하고 중앙 텍스트는 깜빡 잊는 일이 반복돼서, 도넛 조각과 중앙 숫자가 서로 다른 값을 보여주는 버그가 여러 차례 재발했다 (커밋 `f6470f1`은 이 증상을 슬라이스 데이터 수정 없이 라벨 문자열만 바꿔 임시 봉합한 사례).  
> 지금 구조에서는 **소재별 `v` 값만 갱신하면 중앙 수치는 자동으로 맞다** — 별도로 손댈 부분 없음. 새 소재 추가/종료 시에도 슬라이스 배열만 수정하면 된다.

```js
drawDonut('clickDonutCost', [
  {lbl:'소재명 (프로그램)', v:비용, c:색상코드}, ...
], '6월 총 광고비', function(v){return Math.round(v/10000)+'만원';});

drawDonut('clickDonutClicks', [
  {lbl:'소재명 (프로그램)', v:클릭수, c:색상코드}, ...
], '6월 총 클릭수', function(v){return (v/10000).toFixed(1)+'만';});
```

---

## 6단계 — 후속조회 라플위클리 카드 업데이트

**HTML 위치**: `id="page-retarget"` → `.prog-card` (라플위클리 카드)

**데이터 소스**: `$wsRetgt` R55 소재별 6월합계 (토이스토리+실수+스필버그 합산)

```powershell
# 토이스토리(C2~C11) + 실수(C12~C21) + 스필버그(C22~C31) 합산
$rw_cost  = $wsRetgt.Cells(55,4)  + $wsRetgt.Cells(55,14) + $wsRetgt.Cells(55,24)
$rw_imp   = $wsRetgt.Cells(55,5)  + $wsRetgt.Cells(55,15) + $wsRetgt.Cells(55,25)
$rw_views = $wsRetgt.Cells(55,6)  + $wsRetgt.Cells(55,16) + $wsRetgt.Cells(55,26)
$rw_click = $wsRetgt.Cells(55,7)  + $wsRetgt.Cells(55,17) + $wsRetgt.Cells(55,27)
$rw_ctr   = [Math]::Round($rw_click/$rw_imp*100, 2)
$rw_cpv   = [Math]::Round($rw_cost/$rw_views)
```

업데이트 항목: 집행액, 노출, 조회, CTR, CPV

---

## 7단계 — 전환 퍼널 + 롱폼 callout 업데이트

**HTML 위치**: `id="page-conv"` → 퍼널 섹션 + callout 섹션

**데이터 소스**: `$wsConv` R184 (일별총합 6월합계) + R377 (소재별 6월합계)

### 전환 퍼널 (노출→조회→클릭→전환)

```powershell
# R184 기준
$cv_view_rate = [Math]::Round($cv_views/$cv_imp*100, 2)   # 조회율(%)
# 노출 C5, 조회율, 클릭 C7, CTR C9*100, 전환 C12, CVR C13*100, 구독단가
```

**HTML 패턴**:
```html
노출 X,XXX,XXX → 조회 XX,XXX(X.XX%) → 클릭 XX,XXX(CTR X.XX%) → 전환 X,XXX건(CVR XX.X%, 단가 X,XXX원)
```

### 롱폼 합계 callout

```powershell
# 소재별 6월합계 합산 (R377)
$cv_lf_cost = $wsConv.Cells(377,4) + $wsConv.Cells(377,14) + $wsConv.Cells(377,24)
```

업데이트 항목: 6월 광고비, 구독 전환건수, 구독단가, CTR, CVR

---

## 8단계 — 개요 탭 mbar CTR 업데이트

**HTML 위치**: `id="page-overview"` → "프로그램별 클릭 최대화 · CPC 비교" 카드 → `.mbar-row` 3개

**데이터 소스**: `$wsClick` R104 소재별 6월합계 CTR

```powershell
$mbar_weekly = [Math]::Round(($wsClick.Cells(104,7)+$wsClick.Cells(104,17)) /
               ($wsClick.Cells(104,5)+$wsClick.Cells(104,15)) * 100, 2)  # 라플위클리 CTR
$mbar_hot    = [Math]::Round($wsClick.Cells(104,29)*100, 2)               # HOT&NEW CTR
# 딥다이브 CTR: 딥다이브_조회 시트 6월합계 CTR 또는 클릭최대화 딥다이브 소재 CTR
```

**bar width 계산**: `라플위클리=100%` 기준으로 상대 비율 적용
```
HOT&NEW bar% = round(mbar_hot / mbar_weekly * 100)
딥다이브 bar% = round(mbar_deep / mbar_weekly * 100)
```

**HTML 패턴**:
```html
<div class="mbar-fill" style="width:100%"><span class="mbar-num">CTR X.XX%</span></div>   ← 라플위클리
<div class="mbar-fill" style="width:XX%"><span class="mbar-num">CTR X.XX%</span></div>    ← HOT&NEW
<div class="mbar-fill" style="width:XX%"><span class="mbar-num">CTR X.XX%</span></div>    ← 딥다이브
```

---

## 9단계 — JUNE 객체 업데이트 (클릭최대화 소재별 일별)

### 시트: `디맨드젠_클릭최대화`

**소재별 섹션 위치**: R102 (헤더), R104 (6월합계), R105+ (일별)

**열 구조** (R102 헤더 행):
| 소재 | 날짜열 | 비용 | 노출 | 조회 | 클릭 | CPM | CTR | CPC | CPV |
|------|--------|------|------|------|------|-----|-----|-----|-----|
| 라플위클리_스필버그 | C2 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 |
| 라플위클리_토이스토리 | C12 | C14 | C15 | C16 | C17 | C18 | C19 | C20 | C21 |
| 핫앤뉴_16화_토이스토리 | C22 | C24 | C25 | C26 | C27 | C28 | C29 | C30 | C31 |

**HTML 입력 형식**: `[lbl, ep, prog, cost, imp, ctr, clicks, cpc, cpv]`

```javascript
{lbl:'토이스토리', ep:'위클리 S5 13화', prog:'weekly',
 cost: C14(반올림), imp: C15, ctr: C19*100(소수2자리), clicks: C17, cpc: C20(반올림), cpv: C11(반올림)}
{lbl:'스필버그',   ep:'위클리 S6 19화', prog:'weekly', ...}
{lbl:'토이스토리', ep:'HOT&NEW 16화',   prog:'hot',   ...}  ← cost > 0인 경우만 추가
```

**추가할 날짜**: HTML 마지막날 다음부터 `보고서기준일 - 1일`까지

---

## 10단계 — RD 객체 업데이트 (후속조회 일별 총합)

### 시트: `디맨드젠_후속조회`

**일별 총합 위치**: R17 (헤더), R19 (6월합계), R20+ (일별)

**열 구조**:
| C2(날짜시리얼) | C3(요일) | C4(비용) | C5(노출) | C6(조회수) | C7(클릭수) | C9(CTR) |

**HTML 입력 형식**:
```javascript
'6/N': {views: C6, ctr: (C9*100, 소수2자리), cpv: Math.round(C4/C6), cost: Math.round(C4)}
```

---

## 11단계 — RC 객체 업데이트 (후속조회 소재별)

### 시트: `디맨드젠_후속조회`

**소재별 섹션 위치**: R53 (헤더), R55 (6월합계), R56+ (일별)

**열 구조**:
| 소재 | 날짜열 | 비용 | 노출 | 조회 | 클릭 | CPM | CTR | CPC | CPV |
|------|--------|------|------|------|------|-----|-----|-----|-----|
| 라플위클리_토이스토리 | C2 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 |
| 라플위클리_실수(시즌1 9화) | C12 | C14 | C15 | C16 | C17 | C18 | C19 | C20 | C21 |
| 라플위클리_스필버그 | C22 | C24 | C25 | C26 | C27 | C28 | C29 | C30 | C31 |

**HTML 입력 형식**: `[조회수, 클릭수, CTR%(소수2자리), CPV(반올림), 비용(반올림)]`

**활성 소재 확인**: 해당 날짜 행의 C4(비용) > 0인 소재만 업데이트

**OFF 캠페인** (R87+): 원더풀스(핫앤뉴11화), 군체(딥다이브6화) — 종료일 이후 추가 불필요

---

## 12단계 — CONV 객체 업데이트 (전환 일별 총합)

### 시트: `디맨드젠_전환캠페인`

**6월 일별 총합 위치**: R184 (6월합계), R185+ (일별)

**열 구조**:
| C2(날짜시리얼) | C3(요일) | C4(비용) | C5(노출) | C6(조회수) | C7(클릭) | C9(CTR) | C12(전환건수) | C13(CVR) |

**HTML 입력 형식**:
```javascript
'6/N': {conv: C12(반올림), cvr: C13*100(소수1자리), cost: Math.round(C4)}
```

---

## 13단계 — CC 객체 업데이트 (전환 소재별)

### 시트: `디맨드젠_전환캠페인`

**소재별 섹션 위치**: R219 (헤더), R377 (6월합계), R225+ (1월1일~)

**열 구조** (R219 헤더):
| 소재 | 날짜열 | 비용 | 노출 | 조회 | 클릭 | CPM | CTR | CPC | CPV |
|------|--------|------|------|------|------|-----|-----|-----|-----|
| 딥다이브_6화_군체 | C2 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 |
| 시즌6_19화_스필버그 | C12 | C14 | C15 | C16 | C17 | C18 | C19 | C20 | C21 |
| 시즌5_13화_토이스토리 | C22 | C24 | C25 | C26 | C27 | C28 | C29 | C30 | C31 |

**6월 N일 행 위치**: `R375 + N - 1`  
(계산: R225 + 150(1월1일~5월31일) + (N-1))

**HTML 입력 형식**: `[조회수, 클릭수, CTR%(소수2자리), CPV(반올림), 비용(반올림)]`

**활성 소재만 추가**: 비용 > 0인 소재 (군체는 6/17 이후 종료, 스필버그/토이스토리는 계속 활성)

---

## 14단계 — CREATIVES 배열 업데이트 (조회캠페인 소재별)

> 이 배열은 **캠페인 기간 누적 합산**이므로 매일 전체 값을 갱신한다.

### 시트별 데이터 위치

**HOT&NEW_조회** (`HOT & NEW_조회`):
- 6월합계 행: R97 (total), 이후 회차별 R163+
- 핫앤뉴_N화: 각 회차 헤더 행 찾아 6월합계 읽기

**라플위클리_조회** (`라플위클리_조회`):
- 회차별 6월합계 읽기 (시트 구조 동일)

**딥다이브_조회** (`딥다이브_조회`):
- 회차별 6월합계 읽기

### HOT&NEW 16화 특별 처리

HOT&NEW 16화는 **조회캠페인 + 클릭최대화 캠페인** 합산값을 CREATIVES에 표시:
- `imp` = 조회시트 imp + `$wsClick.Cells(104,25)` (클릭최대화 6월합계)
- `views` = 조회시트 조회수 + `$wsClick.Cells(104,26)`
- `clicks` = 조회시트 클릭수 + `$wsClick.Cells(104,27)`
- `ctr` = total_clicks / total_imp * 100
- `vtr` = total_views / total_imp * 100
- `cpv` = total_cost / total_views (반올림)

### HTML 입력 형식

```javascript
{fmt:'롱폼', prog:'HOT&NEW', ep:'N화', title:'소재명',
 ctr: 소수2자리, vtr: 소수1자리, cpv: 정수, views: 정수, imp: 정수, clicks: 정수}
```

> **VTR 계산**: `vtr = views / imp * 100` (소수 1자리)

### 딥다이브 뉴뮤지엄 (7화) 소재 구성

딥다이브_조회 시트 R190 (6월합계 행)에서 **3개 소재** 읽기:

| fmt | ep | 비고 |
|-----|-----|------|
| 롱폼 | 7화 | 뉴뮤지엄 롱폼 |
| 쇼츠 | 7화 선공개 | 선공개쇼츠 |
| 쇼츠 | 7화 하이라이트 | 하이라이트쇼츠1 |

쇼츠는 2편(선공개 + 하이라이트쇼츠1)이다. 1편만 추가하지 않도록 주의.

### 롱폼/쇼츠 필터 버튼 개수 수동 관리

CREATIVES 배열에 항목 추가/삭제 시 테이블 상단 필터 버튼의 개수도 수동으로 함께 업데이트한다:

```html
<button onclick="filterFmt('롱폼')">롱폼 (N개)</button>
<button onclick="filterFmt('쇼츠')">쇼츠 (N개)</button>
```

버튼 숫자 = CREATIVES 배열에서 해당 fmt 항목 수 (코드에서 자동 계산되지 않음).

---

## 15단계 — 개요 탭 코멘트·인사이트·icard 업데이트

> 수치는 엑셀에서 계산, 텍스트는 당일 운영 현황 반영

### 개요 최신 코멘트 (HTML: `.sect-lbl` 다음 `.sum-row` 또는 comment 블록)

업데이트 항목:
- 날짜: `6/1~6/N` (N = 보고서기준일 - 1)
- 클릭최대화 클릭수·CTR: `$ck_click`만건, `$ck_ctr`%
- 후속조회 CPV·조회수: `$rt_cpv`원·누적 `$rt_views/10000`만 조회
- 전환 건수·단가: `$cv_conv`건·단가 `$cv_cpsub`원
- 활성 소재 현황: 당일 운영 중인 소재명 반영 (수동 확인)

### 월간 인사이트 섹션 (`.sum-insight`)

```html
<div class="sect-lbl">월간 주요 인사이트 — 6월 1일~N일 종합 분석</div>
```
- 날짜 텍스트 N 업데이트
- 전체 요약 문구에서 소진율·구독단가·소진금액 수치 업데이트

### icard 수치 업데이트 (`.icard-grid` 4개 카드)

| 카드 | 업데이트 수치 |
|------|-------------|
| 조회캠페인 | 예산 소진율% |
| 클릭최대화 | CTR%, 누적 클릭수(만건), 라플위클리 CTR%, HOT&NEW CTR% |
| 후속조회 | 누적 조회수(만 조회) |
| 전환 | 구독단가, CVR%, 누적 전환건수 |

### 월별 CTR 추이 차트 (`var months`)

클릭최대화 탭 내 "월별 CTR 추이" 차트는 `var months` 배열이 하드코딩되어 있다.  
월말 마감 시 `'6월(~28일)'` 형태의 텍스트를 실제 최종일로 직접 수정한다:

```javascript
var months = ['4월', '5월', '6월(~30일)'];  // 예: 6월 마감 반영 시
```

### 클릭최대화 프로그램별 클릭수 차트 (`clickProg`)

이 차트의 data 배열 형식은 **전환 롤링 차트와 다르다** — `c`(컬러) 속성이 필수:

```javascript
var data = [
  {lbl:'라플위클리', sub:'X,XXX만원', v: 클릭수, c: C.weekly},  // #4B8EFF
  {lbl:'HOT&NEW',   sub:'X,XXX만원', v: 클릭수, c: C.hot},     // #FF3B5C
  {lbl:'딥다이브',  sub:'X,XXX만원', v: 클릭수, c: C.deep}     // #22C55E
];
var maxV = 적절한_상한값;
```

`c` 속성이 없으면 `fillStyle=undefined`로 차트가 완전히 미표시된다. 항상 명시할 것.  
데이터 소스: 클릭최대화 탭 각 프로그램 카드의 클릭수 합계 / 집행액.

### retargetDaily raw 배열 (후속조회 일별)

HTML 내 `retargetDaily` raw 배열에 새 날짜 항목을 추가한다:

```javascript
{d:'6/N', views: RD['6/N'].views, ctr: RD['6/N'].ctr, cpv: RD['6/N'].cpv, cost: RD['6/N'].cost}
```

`ctr` 필드 = Excel CTR % 문자열 (예: `'3.49'`) — **× 100 하지 않음**, 그대로 문자열로 입력.  
단, `raw ctr` 계산 시: `parseInt(ctr * 100)` 방식으로 정수 변환하는 부분 확인 필요.

### 인사이트 카드 텍스트 (하드코딩 영역)

`.sum-insight` 섹션 내 서술형 문구는 **엑셀 수치로 자동 계산되지 않는다**. 수치 업데이트 후 수동으로 반영:

- 전체 소진율 문구: `"6,983만원 예산 중 XX% 소진"`
- 구독단가 문구: `"구독당 단가 X,XXX원 달성"`
- 누적 전환 문구: `"누적 X,XXX건 구독 전환"`
- 날짜 범위: `"6월 1일~N일 종합 분석"`

---

## 16단계 — 검증 체크리스트

업데이트 후 아래 항목을 자동 계산으로 검증한다.

```
[ ] 개요 KPI 총 광고비 = 조회+클릭+후속+전환 집행액 합산 ✓
[ ] JUNE '6/N' 비용합계 ≈ 디맨드젠_클릭최대화 일별총합 해당일 (R69+ C4)
[ ] RD '6/N' cost ≈ 후속조회 일별총합 해당일 R20+ C4 ±1원
[ ] CONV '6/N' cost ≈ 전환캠페인 일별총합 해당일 R185+ C4 ±1원
[ ] CC 군체+스필버그+토이스토리 합계 ≈ CONV cost ±100원
[ ] RC 토이스토리+실수+스필버그 합계 ≈ 후속조회_라플위클리 subtotal ±1원
[ ] CREATIVES HOT&NEW 16화 views = 조회시트 + 클릭최대화 합산 ✓
[ ] 클릭최대화 카드 집행액 합산 = KPI 총 집행액 ✓
[ ] 후속조회 카드 집행액 = R19 C4 만원단위 ✓
[ ] 전환 퍼널 전환건수 = R184 C12 ✓
[ ] 도넛 차트(clickDonutCost/clickDonutClicks) 중앙 수치는 자동 계산이므로 slices `v` 합계와 항상 일치 — 별도 검증 불필요, 하드코딩 회귀 여부만 확인 ✓
```

---

## 17단계 — GitHub 푸시 (GitHub Pages 자동 배포)

검증이 완료되면 아래 PowerShell 명령으로 변경사항을 GitHub에 푸시한다.  
푸시 즉시 `.github/workflows/deploy-pages.yml`(GitHub Actions)이 감지하여 **자동으로 배포**한다 (통상 30초~1분 소요).

```powershell
# 현재 작업 디렉토리 기준 (Set-Location 불필요)
git add "라플TV_캠페인_대시보드.html"
git commit -m "대시보드 업데이트: 6/N 데이터 반영"
git push origin main
```

> 커밋 메시지의 날짜(6/N)는 실제 업데이트한 날짜로 교체한다.  
> 푸시 후 GitHub Actions → GitHub Pages로 자동 배포한다 (통상 30초~1분).  
> 배포 URL: `https://sjh0927-hash.github.io/hanwha-ax-dashboard/라플TV_캠페인_대시보드.html`

---

## 검증 이력

### 실행 사례 — 260625.xlsx → 라플TV_캠페인_대시보드.html (6/24 반영)

| 단계 | 입력 | 출력 | 결과 |
|------|------|------|------|
| KPI 추출 | Grand total R16, 각 시트 6월합계 | 5개 탭 KPI 수치 | 개요·클릭·후속·전환 전체 갱신 |
| 일별 데이터 | 디맨드젠 3개 시트 일별 행 | JUNE·RD·RC·CONV·CC 객체 | 6/24 행 추가 완료 |
| 검증·배포 | HTML diff 확인 | git push → GitHub Pages | 30초 내 자동 배포 |

### 고친 흔적 (커밋 순)

1. **`4029032` 클릭최대화 예산 소진율 오류** — R104(소재별 6월합계)로 비용 합산했더니 383만원(38% 소진) 오산 → R68(일별총합 6월합계)이 실제 집행액 기준임을 확인하고 소스 행 수정 (945만원, 95%)
2. **`5cdfa0a` JS 구문 오류** — 미니바 IIFE 내부 `${...}` 닫기 괄호 누락으로 날짜버튼 파손 → 스킬에 "JUNE 객체 갱신 후 반드시 브라우저 날짜버튼 클릭 동작 확인" 체크 추가
3. **`94dd5ed` 딥다이브 CPV 미노출** — 조회캠페인 딥다이브 CPV 칸이 0으로 표시 → 딥다이브_조회 시트 6월합계 행 위치가 다른 IP와 다름을 확인; 14단계 CREATIVES 추출 전 헤더 행 탐색 단계 명시
4. **`replace_all 사이드이펙트` clickProg 차트 미표시** — 전환 롤링 7일 차트(`cv1`)와 프로그램별 클릭수 차트(`clickProg`)가 동일한 `var data=[{lbl:'6/XX',...}]` 패턴 공유 → replace_all로 교체 시 clickProg 데이터가 전환 데이터로 덮어써짐 → `d.c` 속성 없어 차트 미표시. clickProg 데이터는 `{lbl, sub, v, c}` 형식으로 수동 복원.
5. **`CC '6/29' 복사 버그`** — CC 객체에 새 날짜(6/29) 추가 시 군체/토이스토리/스필버그 3개 소재 모두 직전 날짜(6/26) 값이 그대로 복사됨. 실데이터 확인 후 수정. 신규 날짜 추가 후 반드시 직전 날짜 값과 비교 검증 필수.
6. **`뉴뮤지엄 쇼츠 1편 누락`** — CREATIVES 배열에 딥다이브 7화 뉴뮤지엄 쇼츠가 1편(선공개)만 있고 하이라이트쇼츠1 누락. 딥다이브_조회 R190 기준 3개 소재(롱폼+선공개쇼츠+하이라이트쇼츠1) 모두 추가. 롱폼/쇼츠 버튼 개수도 함께 수정.
7. **`Grand total 열 매핑 오류`** — 스킬 문서에 C9=노출, C10=조회, C11=클릭으로 오기재 → 실제는 C6=노출, C7=조회, C8=클릭, C12=소진금액. 스킬 문서 수정 완료.
8. **도넛 차트 중앙 수치 미갱신 반복 재발** — `drawDonut()` 중앙 총계(`945만원`, `23.9만`)가 문자열로 하드코딩돼 있어 소재별 `v` 값을 갱신해도 중앙 텍스트는 안 바뀌는 일이 반복됨 (`f6470f1`은 슬라이스 데이터는 그대로 두고 라벨 문자열만 손으로 고쳐 임시 봉합 — 근본 원인 미해결). **구조적으로 수정**: `drawDonut(canvasId, slices, centerSub, fmt)`가 `slices` 합계를 `fmt` 콜백으로 포맷해 자동 표시하도록 변경 → 중앙 수치를 손으로 만질 필요 자체를 제거. 상세: [5-1단계](#5-1단계--광고비클릭수-도넛-차트-소재-데이터-업데이트).

---

## 참고: 주요 시트 구조 요약

| 시트명 | 일별총합 6월합계 | 소재별 6월합계 |
|--------|----------------|--------------|
| 디맨드젠_클릭최대화 | R69~(행 확인 필요) | R104 (C4/C14/C24=비용) |
| 디맨드젠_후속조회 | R19 (C4=비용) | R55 (C4/C14/C24=비용) |
| 디맨드젠_전환캠페인 | R184 (C4=비용, C12=전환) | R377 (C4/C14/C24=비용) |
| HOT&NEW_조회 | R97~ | R163~(회차별) |
| Grand total | R16 = 유튜브 subtotal | C6=노출, C7=조회, C8=클릭, C12=소진금액(VAT+) |

## 참고: KPI 컬러 클래스 규칙

| class | 색상 | 사용 지표 |
|-------|------|----------|
| `kpi a` | orange | 광고비·집행액·CPC (비용·효율 지표) |
| `kpi t` | teal | 조회수·CTR·CPV·CVR·전환건수 (긍정 성과 지표) |
| `kpi` | 기본 | 노출수·기타 참고 지표 |

## 참고: 파일 위치

```
<프로젝트 루트>/                                           ← git clone 위치 (Claude Code 작업 디렉토리)
├── 차이_한화_라이프플러스_라플TV_Report_6월_26MMDD.xlsx   ← 엑셀 원본 (팀 내부 비밀번호)
└── 라플TV_캠페인_대시보드.html                            ← 업데이트 대상 대시보드
```
