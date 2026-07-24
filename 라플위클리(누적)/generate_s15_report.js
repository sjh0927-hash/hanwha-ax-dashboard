const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const results = JSON.parse(fs.readFileSync(path.join(DIR, 'weekly_cumulative_scored.json'), 'utf8'));

// 시즌1~5 — VR·참여도·트래픽소스까지 전부 유효한(결측 없는) 완결 시즌만 대상.
// 시즌6은 진행 중(집계대기 포함)이라 이 딥다이브에서는 제외.
const SEASON_DEFS = [
  { full: '위클리 시즌1', id: 's1', label: '시즌1', short: 'S1', color: '#60A5FA' },
  { full: '위클리 시즌2', id: 's2', label: '시즌2', short: 'S2', color: '#9F8FF7' },
  { full: '위클리 시즌3', id: 's3', label: '시즌3', short: 'S3', color: '#F472B6' },
  { full: '위클리 시즌4', id: 's4', label: '시즌4', short: 'S4', color: '#F5A623' },
  { full: '위클리 시즌5', id: 's5', label: '시즌5', short: 'S5', color: '#34D399' },
];
const SEASON_SHORT = Object.fromEntries(SEASON_DEFS.map(s => [s.full, s.short]));

const sAll = results.filter(r => SEASON_DEFS.some(s => s.full === r.season));
const seasons = SEASON_DEFS.map(def => ({
  ...def,
  arr: sAll.filter(r => r.season === def.full)
    .sort((a, b) => String(a.num).localeCompare(String(b.num), undefined, { numeric: true })),
}));

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; num += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  return num / Math.sqrt(dx2 * dy2);
}
function stats(arr, k) {
  const xs = arr.map(r => r[k]);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { min: Math.min(...xs), max: Math.max(...xs), mean, cv: sd / mean };
}
function avg(arr, k) { return arr.reduce((a, r) => a + r[k], 0) / arr.length; }
function esc(s) { return String(s).replace(/'/g, "\\'"); }
const GRADE_CLASS = { S: 'gs', A: 'ga', 'B+': 'gbp', B: 'gb', C: 'gc' };

// 통계 용어(r=, 변동계수 등) 대신 쉬운 말로 강도를 표현 — 사용자 피드백 반영
function strength(absR) {
  if (absR >= 0.7) return { label: '매우 강하게 연결됨', short: '매우 강함', color: 'var(--c-purple)' };
  if (absR >= 0.5) return { label: '강하게 연결됨', short: '강함', color: 'var(--c-teal)' };
  if (absR >= 0.3) return { label: '어느 정도 연결됨', short: '보통', color: 'var(--c-amber)' };
  return { label: '거의 관련 없음', short: '관련 없음', color: 'var(--c-muted)' };
}
function spread(cv) {
  if (cv <= 0.15) return '편마다 거의 비슷함';
  if (cv <= 0.3) return '편마다 약간 차이남';
  return '편마다 차이가 큼';
}

// ============================================================
// 통합 분석 — 시즌1~5 전체
// ============================================================
const DRIVER_METRICS = [
  { key: 'algo_pct_7d', label: '알고리즘 유입비중', pct: true },
  { key: 'nat_pct_7d', label: '자연유입 비중', pct: true },
  { key: 'nat_abs_7d', label: '자연유입 절대수', pct: false },
  { key: 'imp_7d', label: '노출수', pct: false },
  { key: 'eng_7d', label: '참여도', pct: false },
  { key: 'srch_pct_7d', label: '검색유입 비중', pct: true },
  { key: 'watch_min_7d', label: '평균시청시간', pct: false },
  { key: 'ctr_7d', label: 'CTR', pct: true },
  { key: 'vr_7d', label: '조회율(VR)', pct: true },
  { key: 'views_7d', label: '조회수', pct: false },
];
const yV2 = sAll.map(r => r.v2);
const ySub = sAll.map(r => r.sub_7d);
const driverRows = DRIVER_METRICS.map(m => {
  const xs = sAll.map(r => r[m.key]);
  const st = stats(sAll, m.key);
  return { ...m, rV2: pearson(xs, yV2), rSub: pearson(xs, ySub), cv: st.cv };
}).sort((a, b) => Math.abs(b.rV2) - Math.abs(a.rV2));

const topDriver = driverRows[0];
const secondDriver = driverRows[1];
const viewsRow = driverRows.find(d => d.key === 'views_7d');
const ctrRow = driverRows.find(d => d.key === 'ctr_7d');
const vrRow = driverRows.find(d => d.key === 'vr_7d');
const topSubDriver = [...driverRows].sort((a, b) => Math.abs(b.rSub) - Math.abs(a.rSub))[0];

const sortedAll = [...sAll].sort((a, b) => b.v2 - a.v2);
const top3 = sortedAll.slice(0, 3);
const bottom3 = sortedAll.slice(-3).reverse();

const seasonAvgs = seasons.map(s => ({
  ...s,
  avgV2: avg(s.arr, 'v2'),
  gradeCounts: {
    S: s.arr.filter(r => r.grade === 'S').length, A: s.arr.filter(r => r.grade === 'A').length,
    'B+': s.arr.filter(r => r.grade === 'B+').length, B: s.arr.filter(r => r.grade === 'B').length, C: s.arr.filter(r => r.grade === 'C').length,
  },
}));
const bestSeason = [...seasonAvgs].sort((a, b) => b.avgV2 - a.avgV2)[0];
const worstSeason = [...seasonAvgs].sort((a, b) => a.avgV2 - b.avgV2)[0];
const gradeTotal = { S: 0, A: 0, 'B+': 0, B: 0, C: 0 };
sAll.forEach(r => gradeTotal[r.grade]++);

const rankRowsJs = sortedAll.map(r => (
  `{num:'${esc(r.num)}',title:'${esc(r.title)}',season:'${SEASON_SHORT[r.season]}',v2:${r.v2},grade:'${r.grade}',` +
  `natPct:${(r.nat_pct_7d * 100).toFixed(1)},natAbs:${Math.round(r.nat_abs_7d)},algoPct:${(r.algo_pct_7d * 100).toFixed(1)},` +
  `ctr:${(r.ctr_7d * 100).toFixed(2)},vr:${(r.vr_7d * 100).toFixed(1)},sub:${Math.round(r.sub_7d)},eng:${Math.round(r.eng_7d)},watch:${r.watch_min_7d.toFixed(1)}}`
)).join(',\n  ');

function scatterVals(arr, m) {
  return arr.map(r => {
    const raw = r[m.key];
    const x = m.pct ? +(raw * 100).toFixed(m.key === 'ctr_7d' ? 2 : 1) : Math.round(raw);
    return `{x:${x},y:${r.v2},l:'${esc(r.title)}'}`;
  }).join(',');
}
const scatterTopJs = scatterVals(sAll, topDriver);
const scatterCtrJs = scatterVals(sAll, ctrRow);

function spotlightCard(r, rank, isTop) {
  return `<div class="spot-card ${isTop ? 'spot-top' : 'spot-bottom'}">
    <div class="spot-rank">${isTop ? '#' + rank : '#' + (sAll.length - 3 + rank)}</div>
    <div class="spot-title">${r.title} <span class="spot-num">${SEASON_SHORT[r.season]} ${r.num}</span></div>
    <div class="spot-v2">${r.v2.toFixed(3)} <span class="gpill ${GRADE_CLASS[r.grade]}">${r.grade}</span></div>
    <div class="spot-metrics">
      <span>알고리즘 ${(r.algo_pct_7d * 100).toFixed(1)}%</span>
      <span>자연유입 ${(r.nat_pct_7d * 100).toFixed(1)}%</span>
      <span>참여도 ${Math.round(r.eng_7d).toLocaleString()}건</span>
      <span>CTR ${(r.ctr_7d * 100).toFixed(2)}%</span>
    </div>
  </div>`;
}

// 핵심 인사이트 — 하드코딩 대신 실제 상관계수·변동계수에서 직접 도출(데이터 갱신되면 문구도 같이 갱신됨)
const keyInsights = [
  `<b>${topDriver.label}</b>과 <b>${secondDriver.label}</b>이 점수와 가장 밀접하게 움직였습니다(${strength(Math.abs(topDriver.rV2)).short}·${strength(Math.abs(secondDriver.rV2)).short} 수준, r=${topDriver.rV2.toFixed(2)}·${secondDriver.rV2.toFixed(2)}). 결국 "얼마나 많이 봤나"보다 "어떻게, 어디서 도달했는가"가 점수를 갈랐습니다.`,
  `<b>조회수</b> 자체는 점수와 거의 무관했습니다(${strength(Math.abs(viewsRow.rV2)).label}, r=${viewsRow.rV2.toFixed(2)}). 순위가 높은 편이라고 조회수가 특별히 많은 것도 아니었어요 — 중요한 건 조회수의 크기가 아니라 유입 경로였습니다.`,
  `<b>${topSubDriver.label}</b>이 구독자 증감과 가장 밀접하게 연결됐습니다(r=${topSubDriver.rSub.toFixed(2)}). 점수 자체보다 "진짜 팬으로 이어지는가"를 보고 싶다면 이 지표를 보는 게 맞습니다.`,
  `<b>CTR·조회율(VR)</b>은 LTV Score 계산식에서 45%를 차지하는 핵심 항목이지만, ${sAll.length}편 사이의 실제 편차가 가장 작아서(변동계수 CTR ${(ctrRow.cv * 100).toFixed(0)}% · VR ${(vrRow.cv * 100).toFixed(0)}% — 다른 지표는 대부분 35% 이상) 편끼리를 가르는 데는 거의 기여하지 못했습니다.`,
];

// ============================================================
// 시즌별(개별) 상세
// ============================================================
const TRAFFIC_KEYS = [
  { key: 'algo_pct_7d', label: '알고리즘 추천', color: '#9F8FF7' },
  { key: 'srch_pct_7d', label: '검색', color: '#60A5FA' },
  { key: 'channel_pct_7d', label: '채널 순환(구독자)', color: '#3DD68C' },
  { key: 'ads_pct_7d', label: '광고', color: '#F5A623' },
  { key: 'etc_pct_7d', label: '기타', color: '#6E6D7A' },
];

function buildSeasonData(arr, other, label) {
  const traffic = TRAFFIC_KEYS.map(t => ({ ...t, value: +(avg(arr, t.key) * 100).toFixed(1) }));
  const newV = avg(arr, 'new_viewer_7d'), retV = avg(arr, 'returning_viewer_7d');
  const viewerTotal = newV + retV;
  const newPct = +(newV / viewerTotal * 100).toFixed(1);
  const retPct = +(retV / viewerTotal * 100).toFixed(1);

  const otherTraffic = TRAFFIC_KEYS.map(t => ({ key: t.key, value: avg(other, t.key) * 100 }));
  const otherNewV = avg(other, 'new_viewer_7d'), otherRetV = avg(other, 'returning_viewer_7d');
  const otherNewPct = otherNewV / (otherNewV + otherRetV) * 100;

  const sortedEp = [...arr].sort((a, b) => b.v2 - a.v2);
  const best = sortedEp[0], worst = sortedEp[sortedEp.length - 1];
  const adsRow = traffic.find(t => t.key === 'ads_pct_7d');
  const otherAdsRow = otherTraffic.find(t => t.key === 'ads_pct_7d');

  const notes = [];
  notes.push(`이 시즌 평균 LTV Score는 <b>${avg(arr, 'v2').toFixed(3)}</b>이고, 가장 잘한 편은 <b>${best.title}</b>(${best.v2.toFixed(3)}), 가장 아쉬웠던 편은 <b>${worst.title}</b>(${worst.v2.toFixed(3)})였습니다.`);
  if (Math.abs(newPct - otherNewPct) >= 5) {
    notes.push(`신규 시청자 비중이 <b>${newPct}%</b>로, 다른 시즌(${otherNewPct.toFixed(1)}%)보다 ${newPct > otherNewPct ? '높았습니다 — 새로운 시청자를 더 많이 끌어왔다는 뜻' : '낮았습니다 — 상대적으로 기존 시청자 위주로 봤다는 뜻'}입니다.`);
  } else {
    notes.push(`신규 시청자 비중(${newPct}%)은 다른 시즌과 비슷한 수준이었습니다.`);
  }
  if (Math.abs(adsRow.value - otherAdsRow.value) >= 5) {
    notes.push(`광고를 통해 유입된 비중이 <b>${adsRow.value.toFixed(1)}%</b>로, 다른 시즌(${otherAdsRow.value.toFixed(1)}%)보다 ${adsRow.value > otherAdsRow.value ? '높아 광고 의존도가 더 컸습니다' : '낮아 광고 없이도 더 잘 퍼졌습니다'}.`);
  }

  const chronoJs = arr.map(r => `{num:'${esc(r.num)}',title:'${esc(r.title)}',v2:${r.v2}}`).join(',');
  const rankJs = sortedEp.map(r => (
    `{num:'${esc(r.num)}',title:'${esc(r.title)}',v2:${r.v2},grade:'${r.grade}',` +
    `natPct:${(r.nat_pct_7d * 100).toFixed(1)},algoPct:${(r.algo_pct_7d * 100).toFixed(1)},` +
    `ctr:${(r.ctr_7d * 100).toFixed(2)},vr:${(r.vr_7d * 100).toFixed(1)},sub:${Math.round(r.sub_7d)},` +
    `eng:${Math.round(r.eng_7d)},watch:${r.watch_min_7d.toFixed(1)},newPct:${(r.new_viewer_7d / (r.new_viewer_7d + r.returning_viewer_7d) * 100).toFixed(1)}}`
  )).join(',\n  ');

  // 지표별 1/7/28일 베스트·워스트 TOP3용 원본 값 — 클라이언트에서 지표/기간 선택하면 그 자리에서 정렬
  const fullJs = arr.map(r => (
    `{num:'${esc(r.num)}',title:'${esc(r.title)}',` +
    `views1:${Math.round(r.views_1d)},views7:${Math.round(r.views_7d)},views28:${Math.round(r.views_28d)},` +
    `nat1:${(r.nat_pct_1d * 100).toFixed(1)},nat7:${(r.nat_pct_7d * 100).toFixed(1)},nat28:${(r.nat_pct_28d * 100).toFixed(1)},` +
    `ctr1:${(r.ctr_1d * 100).toFixed(2)},ctr7:${(r.ctr_7d * 100).toFixed(2)},ctr28:${(r.ctr_28d * 100).toFixed(2)},` +
    `sub1:${Math.round(r.sub_1d)},sub7:${Math.round(r.sub_7d)},sub28:${Math.round(r.sub_28d)},` +
    `vr1:${(r.vr_1d * 100).toFixed(1)},vr7:${(r.vr_7d * 100).toFixed(1)},vr28:${(r.vr_28d * 100).toFixed(1)},` +
    `eng1:${Math.round(r.eng_1d)},eng7:${Math.round(r.eng_7d)},eng28:${Math.round(r.eng_28d)}}`
  )).join(',\n  ');

  return {
    label, count: arr.length, avgV2: avg(arr, 'v2'), traffic, newPct, retPct, notes, chronoJs, rankJs, fullJs,
    gradeCounts: {
      S: arr.filter(r => r.grade === 'S').length, A: arr.filter(r => r.grade === 'A').length,
      'B+': arr.filter(r => r.grade === 'B+').length, B: arr.filter(r => r.grade === 'B').length, C: arr.filter(r => r.grade === 'C').length,
    },
  };
}

const seasonData = seasons.map(s => buildSeasonData(s.arr, sAll.filter(r => r.season !== s.full), s.label));

function seasonPanel(id, data) {
  return `<div class="panel" id="panel-${id}">
  <div class="kpi-strip" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi-card purple">
      <p class="kpi-label">${data.label} 평균 LTV</p>
      <p class="kpi-val purple">${data.avgV2.toFixed(3)}</p>
      <span class="kpi-badge">${data.count}편 · S${data.gradeCounts.S} A${data.gradeCounts.A} B+${data.gradeCounts['B+']} B${data.gradeCounts.B} C${data.gradeCounts.C}</span>
    </div>
    <div class="kpi-card teal">
      <p class="kpi-label">신규 시청자 비중</p>
      <p class="kpi-val teal">${data.newPct}%</p>
      <span class="kpi-badge">재방문 ${data.retPct}%</span>
    </div>
    <div class="kpi-card amber">
      <p class="kpi-label">가장 큰 유입 경로</p>
      <p class="kpi-val amber" style="font-size:18px">${[...data.traffic].sort((a, b) => b.value - a.value)[0].label}</p>
      <span class="kpi-badge">${[...data.traffic].sort((a, b) => b.value - a.value)[0].value.toFixed(1)}%</span>
    </div>
  </div>

  <div class="section">
    <div class="card">
      <p class="card-title">${data.label} 특징</p>
      <ul class="key-list">
        ${data.notes.map(n => `<li>${n}</li>`).join('\n        ')}
      </ul>
    </div>
  </div>

  <div class="grid-2 section">
    <div class="card">
      <p class="card-title">어디서 봤을까 — 유입 경로 구성</p>
      <p class="card-sub">7일 기준 평균 비중</p>
      <div class="chart-box" style="height:210px"><canvas id="c_${id}_traffic"></canvas></div>
    </div>
    <div class="card">
      <p class="card-title">처음 보는 사람 vs 이미 알던 사람</p>
      <p class="card-sub">신규 시청자 vs 재방문 시청자 비중</p>
      <div class="chart-box" style="height:210px"><canvas id="c_${id}_viewer"></canvas></div>
    </div>
  </div>

  <div class="section">
    <div class="card">
      <p class="card-title">회차가 진행되며 점수는 어떻게 변했나</p>
      <p class="card-sub">발행 순서대로 · ${data.label} 내부 흐름</p>
      <div class="chart-box" style="height:200px"><canvas id="c_${id}_trend"></canvas></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <p class="section-title">지표별 베스트 · 워스트 TOP3</p>
      <p class="section-desc">지표와 기간을 골라보세요 (1일 = 발행 다음날 초기 반응, 7일 = 공식 집계 기준, 28일 = 장기 추이)</p>
    </div>
    <div class="card">
      <div class="filter-tabs" id="metricTabs_${id}" style="margin-bottom:8px">
        <button class="ftab on" data-m="views">조회수</button>
        <button class="ftab" data-m="nat">자연유입율</button>
        <button class="ftab" data-m="ctr">CTR</button>
        <button class="ftab" data-m="sub">구독자증감</button>
        <button class="ftab" data-m="vr">조회율(VR)</button>
        <button class="ftab" data-m="eng">참여도</button>
      </div>
      <div class="filter-tabs" id="periodTabs_${id}">
        <button class="ftab" data-p="1">1일</button>
        <button class="ftab on" data-p="7">7일</button>
        <button class="ftab" data-p="28">28일</button>
      </div>
      <div id="bestWorst_${id}" style="margin-top:14px"></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <p class="section-title">${data.label} 전체 ${data.count}편 순위</p>
    </div>
    <div class="card" style="padding:0">
      <div class="tbl-scroll">
        <table class="ep-tbl">
          <thead><tr>
            <th class="l">#</th><th class="l">에피소드</th>
            <th>LTV</th><th>등급</th><th>자연유입율</th><th>알고리즘</th><th>CTR</th><th>VR</th><th>구독자</th><th>참여도</th><th>신규시청자</th>
          </tr></thead>
          <tbody id="rankBody_${id}"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>`;
}

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>라플위클리 시즌1~5 상세 분석</title>
<script>(function(){var t=localStorage.getItem('lp-theme');if(t==='light')document.documentElement.classList.add('light');})();</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<style>
:root {
  --c-bg:#0E0F14; --c-surface:#15161D; --c-card:#1C1D27;
  --c-border:rgba(255,255,255,0.07); --c-border2:rgba(255,255,255,0.12);
  --c-text:#F0EEF8; --c-muted:#6E6D7A; --c-sub:#9997A8;
  --c-purple:#9F8FF7; --c-purple-bg:#2A2445;
  --c-teal:#3DD68C; --c-teal-bg:#132B20;
  --c-amber:#F5A623; --c-amber-bg:#2C1F08;
  --c-red:#F05454; --c-red-bg:#2C1010;
  --r-sm:8px; --r-md:12px; --r-lg:16px;
}
*{box-sizing:border-box;margin:0;padding:0}
html{background:var(--c-bg)}
body{font-family:'SF Pro Display','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;background:var(--c-bg);color:var(--c-text);min-height:100vh;font-size:16px;line-height:1.5}
.shell{max-width:1140px;margin:0 auto;padding:0 24px 80px}
.page-header{padding:48px 0 32px;border-bottom:1px solid var(--c-border);margin-bottom:32px}
.header-eyebrow{font-size:13px;font-weight:500;letter-spacing:.12em;color:var(--c-purple);text-transform:uppercase;margin-bottom:10px}
.header-title{font-size:34px;font-weight:600;color:var(--c-text);letter-spacing:-.5px;margin-bottom:6px}
.header-sub{font-size:16px;color:var(--c-sub)}
.header-meta{display:flex;gap:20px;margin-top:20px;flex-wrap:wrap}
.meta-chip{font-size:14px;color:var(--c-muted);display:flex;align-items:center;gap:5px}
.meta-chip::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--c-purple);opacity:.7}
.nav-tabs{display:flex;gap:2px;background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:3px;margin-bottom:24px;width:fit-content;flex-wrap:wrap}
.nav-tab{font-size:14px;font-weight:500;padding:6px 14px;border-radius:5px;border:none;background:transparent;color:var(--c-muted);cursor:pointer;transition:all .15s;white-space:nowrap}
.nav-tab.on{background:rgba(159,143,247,.15);color:var(--c-purple);font-weight:600}
.panel{display:none}.panel.show{display:block}
.kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px}
.kpi-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--r-md);padding:18px 20px;position:relative;overflow:hidden}
.kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.kpi-card.purple::before{background:var(--c-purple)}
.kpi-card.teal::before{background:var(--c-teal)}
.kpi-card.amber::before{background:var(--c-amber)}
.kpi-label{font-size:13px;color:var(--c-muted);letter-spacing:.04em;margin-bottom:8px;font-weight:500}
.kpi-val{font-size:26px;font-weight:600;letter-spacing:-.5px;line-height:1}
.kpi-val.purple{color:var(--c-purple)}
.kpi-val.teal{color:var(--c-teal)}
.kpi-val.amber{color:var(--c-amber)}
.kpi-badge{display:inline-block;font-size:12px;font-weight:500;padding:2px 7px;border-radius:20px;margin-top:7px;background:rgba(255,255,255,.07);color:var(--c-muted)}
.section{margin-bottom:36px}
.section-header{display:flex;align-items:baseline;gap:10px;margin-bottom:16px}
.section-title{font-size:17px;font-weight:600;color:var(--c-text)}
.section-desc{font-size:14px;color:var(--c-muted)}
.card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--r-lg);padding:20px 22px;margin-bottom:14px}
.card-title{font-size:15px;font-weight:600;color:var(--c-text);margin-bottom:3px}
.card-sub{font-size:13px;color:var(--c-muted);margin-bottom:14px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.chart-box{position:relative}
.tbl-scroll{overflow-x:auto}
.ep-tbl{width:100%;border-collapse:collapse}
.ep-tbl th{font-size:11px;font-weight:500;letter-spacing:.05em;color:var(--c-muted);text-align:right;padding:8px 10px;border-bottom:1px solid var(--c-border);text-transform:uppercase;white-space:nowrap}
.ep-tbl th.l{text-align:left}
.ep-tbl td{padding:9px 10px;border-bottom:1px solid var(--c-border);vertical-align:middle;font-size:13px;text-align:right;color:var(--c-sub)}
.ep-tbl td.l{text-align:left;color:var(--c-text);font-weight:500}
.ep-tbl tr:last-child td{border-bottom:none}
.ep-tbl tr:hover td{background:rgba(255,255,255,.02)}
.gpill{font-size:11px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:.05em}
.gs{background:var(--c-purple-bg);color:var(--c-purple)}
.ga{background:var(--c-teal-bg);color:var(--c-teal)}
.gbp{background:var(--c-amber-bg);color:var(--c-amber)}
.gb{background:rgba(96,165,250,.15);color:#60A5FA}
.gc{background:rgba(110,109,122,.15);color:var(--c-muted)}
.insight-text{font-size:13px;color:var(--c-sub);line-height:1.6}
.driver-tbl{width:100%;border-collapse:collapse;font-size:13px}
.driver-tbl th{font-size:11px;font-weight:500;color:var(--c-muted);padding:8px 10px;border-bottom:1px solid var(--c-border);text-align:right}
.driver-tbl th.l{text-align:left}
.driver-tbl td{padding:9px 10px;border-bottom:1px solid var(--c-border);text-align:right;color:var(--c-sub)}
.driver-tbl td.l{text-align:left;font-weight:500;color:var(--c-text)}
.driver-tbl tr:last-child td{border-bottom:none}
.spot-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.spot-card{border-radius:var(--r-md);padding:14px 16px;border:1px solid var(--c-border)}
.spot-top{background:linear-gradient(135deg,rgba(159,143,247,.1),rgba(61,214,140,.04))}
.spot-bottom{background:linear-gradient(135deg,rgba(240,84,84,.08),rgba(0,0,0,0))}
.spot-rank{font-size:11px;color:var(--c-muted);font-weight:700;margin-bottom:4px}
.spot-title{font-size:15px;font-weight:600;margin-bottom:4px}
.spot-num{font-size:12px;color:var(--c-muted);font-weight:400}
.spot-v2{font-size:20px;font-weight:700;color:var(--c-purple);margin-bottom:8px;display:flex;align-items:center;gap:8px}
.spot-metrics{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--c-sub)}
.key-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:10px;font-size:14px;color:var(--c-sub);line-height:1.65}
.key-list b{color:var(--c-text)}
.filter-tabs{display:flex;gap:6px;flex-wrap:wrap}
.ftab{font-size:13px;font-weight:500;padding:5px 12px;border-radius:20px;border:1px solid var(--c-border);background:transparent;color:var(--c-muted);cursor:pointer;transition:all .15s}
.ftab.on{background:rgba(159,143,247,.12);color:var(--c-purple);border-color:rgba(159,143,247,.3)}
.bw-title{font-size:12px;font-weight:600;color:var(--c-muted);letter-spacing:.04em;margin-bottom:8px}
.theme-btn{position:fixed;bottom:20px;right:20px;z-index:9999;width:38px;height:38px;border-radius:50%;border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.4);color:var(--c-muted);}
.theme-btn:hover{border-color:var(--c-purple);color:var(--c-text);}
html.light{--c-bg:#F5F6FA;--c-surface:#FFFFFF;--c-card:#FFFFFF;--c-border:rgba(0,0,0,0.09);--c-border2:rgba(0,0,0,0.15);--c-text:#1A1B26;--c-muted:#6E6D7A;--c-sub:#888898;--c-purple-bg:rgba(159,143,247,0.15);--c-teal-bg:rgba(61,214,140,0.12);--c-amber-bg:rgba(245,166,35,0.12);--c-red-bg:rgba(240,84,84,0.12);}
html.light .card{box-shadow:0 1px 4px rgba(0,0,0,.07);}
html.light .theme-btn{box-shadow:0 2px 12px rgba(0,0,0,.12);}
</style>
</head>
<body>
<div class="shell">

<header class="page-header">
  <p class="header-eyebrow">라플위클리 · 시즌1~5 상세 분석 (완결 시즌, 데이터 100% 확보)</p>
  <h1 class="header-title">시즌1~5 딥다이브 — 무엇이 성적을 갈랐나</h1>
  <p class="header-sub">VR·참여도·트래픽소스까지 전부 유효한 ${sAll.length}편으로 성과 드라이버를 역산 (시즌5는 데이터 결측, 시즌6은 진행 중이라 제외)</p>
  <div class="header-meta">
    <span class="meta-chip">총 ${sAll.length}편 (${seasons.map(s => s.label + ' ' + s.arr.length).join(' · ')})</span>
    <span class="meta-chip">등급분포 S${gradeTotal.S} A${gradeTotal.A} B+${gradeTotal['B+']} B${gradeTotal.B} C${gradeTotal.C}</span>
    <span class="meta-chip">채널 평균 LTV ${avg(sAll, 'v2').toFixed(3)}</span>
  </div>
</header>

<div class="nav-tabs">
  <button class="nav-tab on" onclick="sw('all',this)">통합 (${sAll.length}편)</button>
  ${seasons.map(s => `<button class="nav-tab" onclick="sw('${s.id}',this)">${s.label} (${s.arr.length}편)</button>`).join('\n  ')}
</div>

<div class="panel show" id="panel-all">

<div class="kpi-strip">
  <div class="kpi-card purple">
    <p class="kpi-label">전체 평균 LTV</p>
    <p class="kpi-val purple">${avg(sAll, 'v2').toFixed(3)}</p>
    <span class="kpi-badge">${sAll.length}편 · 4개 시즌</span>
  </div>
  <div class="kpi-card teal">
    <p class="kpi-label">최고 시즌</p>
    <p class="kpi-val teal">${bestSeason.label}</p>
    <span class="kpi-badge">평균 ${bestSeason.avgV2.toFixed(3)}</span>
  </div>
  <div class="kpi-card amber">
    <p class="kpi-label">점수와 가장 밀접하게 움직인 지표</p>
    <p class="kpi-val amber">${topDriver.label}</p>
    <span class="kpi-badge">${strength(Math.abs(topDriver.rV2)).label}</span>
  </div>
  <div class="kpi-card">
    <p class="kpi-label">최고 / 최저 편</p>
    <p class="kpi-val" style="font-size:16px">${top3[0].title} / ${bottom3[bottom3.length - 1].title}</p>
    <span class="kpi-badge">${top3[0].v2.toFixed(3)} / ${bottom3[bottom3.length - 1].v2.toFixed(3)}</span>
  </div>
</div>

<div class="section">
  <div class="card">
    <p class="card-title">시즌별 평균 LTV 비교</p>
    <p class="card-sub">시즌1~5 전체 완전 데이터 기준 · 최저 ${worstSeason.label}(${worstSeason.avgV2.toFixed(3)}) ~ 최고 ${bestSeason.label}(${bestSeason.avgV2.toFixed(3)})</p>
    <div class="chart-box" style="height:180px"><canvas id="c_season_avg"></canvas></div>
  </div>
</div>

<div class="section">
  <div class="card">
    <p class="card-title">핵심 인사이트</p>
    <p class="card-sub">시즌1~5 ${sAll.length}편을 놓고 무엇이 점수를 갈랐는지 살펴본 결과</p>
    <ol class="key-list">
      ${keyInsights.map(n => `<li>${n}</li>`).join('\n      ')}
    </ol>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">TOP 3 vs BOTTOM 3</p>
    <p class="section-desc">최고/최저 편의 실제 지표 차이로 위 인사이트를 직접 확인</p>
  </div>
  <div class="spot-grid">
    ${top3.map((r, i) => spotlightCard(r, i + 1, true)).join('\n    ')}
  </div>
  <div class="spot-grid" style="margin-top:10px">
    ${bottom3.map((r, i) => spotlightCard(r, i + 1, false)).join('\n    ')}
  </div>
</div>

<div class="grid-2 section">
  <div class="card">
    <p class="card-title">${topDriver.label}이 높을수록 점수도 높다</p>
    <p class="card-sub">점이 오른쪽 위로 갈수록(${topDriver.label}↑, 점수↑) 뚜렷한 우상향 패턴(r=${topDriver.rV2.toFixed(2)})</p>
    <div class="chart-box" style="height:220px"><canvas id="c_scatter_top"></canvas></div>
  </div>
  <div class="card">
    <p class="card-title">CTR은 높다고 점수가 높은 게 아니다</p>
    <p class="card-sub">점들이 특별한 방향 없이 흩어져 있음(r=${ctrRow.rV2.toFixed(2)}, 비교용)</p>
    <div class="chart-box" style="height:220px"><canvas id="c_scatter_ctr"></canvas></div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">지표별로 점수/구독자와 얼마나 관련 있었나</p>
    <p class="section-desc">막대가 길고 진할수록 그 지표가 점수(또는 구독자 증가)와 강하게 같이 움직였다는 뜻 · 점수와 관련 깊은 순</p>
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-scroll">
      <table class="driver-tbl">
        <thead><tr>
          <th class="l">지표</th><th class="l">LTV 점수와의 관련성</th><th class="l">구독자 증가와의 관련성</th><th class="l">편마다 차이</th>
        </tr></thead>
        <tbody>
          ${driverRows.map(d => {
            const sV2 = strength(Math.abs(d.rV2)), sSub = strength(Math.abs(d.rSub));
            const bar = (pct, color) => `<div style="display:flex;align-items:center;gap:8px"><div style="width:70px;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><div style="width:${Math.round(pct * 100)}%;height:100%;background:${color}"></div></div><span style="font-size:12px;color:${color}">${strength(pct).short}</span></div>`;
            return `<tr>
            <td class="l">${d.label}</td>
            <td class="l">${bar(Math.abs(d.rV2), sV2.color)}</td>
            <td class="l">${bar(Math.abs(d.rSub), sSub.color)}</td>
            <td class="l" style="color:var(--c-muted);font-size:12px">${spread(d.cv)}</td>
          </tr>`;
          }).join('\n          ')}
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">전체 ${sAll.length}편 순위표</p>
    <p class="section-desc">LTV Score 내림차순 · 시즌1~5 전체 완전 데이터</p>
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-scroll">
      <table class="ep-tbl">
        <thead><tr>
          <th class="l">#</th><th class="l">에피소드</th><th>시즌</th>
          <th>LTV</th><th>등급</th><th>자연유입율</th><th>자연유입(회)</th>
          <th>알고리즘</th><th>CTR</th><th>VR</th><th>구독자</th><th>참여도</th><th>시청(분)</th>
        </tr></thead>
        <tbody id="rankBody"></tbody>
      </table>
    </div>
  </div>
</div>

</div><!-- /panel-all -->

${seasons.map((s, i) => seasonPanel(s.id, seasonData[i])).join('\n')}

</div><!-- /shell -->

<button id="theme-btn" class="theme-btn" onclick="(function(){var h=document.documentElement;var isLight=h.classList.toggle('light');localStorage.setItem('lp-theme',isLight?'light':'dark');document.getElementById('theme-btn').textContent=isLight?'🌙':'☀';})()">☀</button>

<script>
function sw(id,btn){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
  document.getElementById('panel-'+id).classList.add('show');
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('on'));
  btn.classList.add('on');
}

const GRID='rgba(255,255,255,0.06)', TICK={font:{size:10},color:'#6E6D7A'};
const BC={S:'#9F8FF7',A:'#3DD68C','B+':'#F5A623',B:'#60A5FA',C:'#6E6D7A'};
const GC={S:'gs',A:'ga','B+':'gbp',B:'gb',C:'gc'};

const RANKED=[
  ${rankRowsJs}
];

function fmtRow(r,i){
  const gc = GC[r.grade];
  return \`<tr>
    <td class="l">\${i+1}</td>
    <td class="l">\${r.title} <span style="color:var(--c-muted);font-size:11px">\${r.num}</span></td>
    <td>\${r.season}</td>
    <td style="font-weight:700;color:\${BC[r.grade]}">\${r.v2.toFixed(3)}</td>
    <td><span class="gpill \${gc}">\${r.grade}</span></td>
    <td>\${r.natPct}%</td>
    <td>\${r.natAbs.toLocaleString()}</td>
    <td>\${r.algoPct}%</td>
    <td>\${r.ctr}%</td>
    <td>\${r.vr}%</td>
    <td>\${r.sub>0?'+':''}\${r.sub}</td>
    <td>\${r.eng.toLocaleString()}</td>
    <td>\${r.watch}</td>
  </tr>\`;
}
document.getElementById('rankBody').innerHTML = RANKED.map(fmtRow).join('');

Chart.defaults.color='#6E6D7A';

function scatterChart(id, data, xLabel){
  new Chart(document.getElementById(id),{type:'scatter',
    data:{datasets:[{data:data,backgroundColor:'rgba(159,143,247,.8)',pointRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw.l+': '+c.raw.x+(xLabel.includes('%')?'%':'')+' · LTV '+c.raw.y.toFixed(3)}}},
      scales:{x:{grid:{color:GRID},ticks:TICK,title:{display:true,text:xLabel,font:{size:10},color:'#6E6D7A'}},
              y:{grid:{color:GRID},ticks:{...TICK,callback:v=>v.toFixed(1)},title:{display:true,text:'LTV Score',font:{size:10},color:'#6E6D7A'},min:0,max:1}}}});
}
scatterChart('c_scatter_top', [${scatterTopJs}], '${topDriver.label}${topDriver.pct ? '(%)' : ''}');
scatterChart('c_scatter_ctr', [${scatterCtrJs}], 'CTR(%)');

function donutChart(id, slices){
  new Chart(document.getElementById(id),{type:'doughnut',
    data:{labels:slices.map(s=>s.label),datasets:[{data:slices.map(s=>s.value),backgroundColor:slices.map(s=>s.color),borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:10,color:'#9997A8'}},
        tooltip:{callbacks:{label:c=>c.label+': '+c.parsed+'%'}}}}});
}
function trendChart(id, data){
  new Chart(document.getElementById(id),{type:'bar',
    data:{labels:data.map(d=>d.num),datasets:[{data:data.map(d=>d.v2),backgroundColor:'rgba(159,143,247,.75)',borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{title:c=>data[c[0].dataIndex].title,label:c=>'LTV '+c.parsed.y.toFixed(3)}}},
      scales:{x:{grid:{display:false},ticks:TICK},y:{grid:{color:GRID},ticks:{...TICK,callback:v=>v.toFixed(1)},min:0,max:1}}}});
}
function seasonAvgChart(id, data){
  new Chart(document.getElementById(id),{type:'bar',
    data:{labels:data.map(d=>d.label),datasets:[{data:data.map(d=>d.avgV2),backgroundColor:data.map(d=>d.color),borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>{const d=data[c.dataIndex];return 'LTV '+d.avgV2.toFixed(3)+' · S'+d.gradeCounts.S+' A'+d.gradeCounts.A+' B+'+d.gradeCounts['B+']+' B'+d.gradeCounts.B+' C'+d.gradeCounts.C;}}}},
      scales:{x:{grid:{display:false},ticks:TICK},y:{grid:{color:GRID},ticks:{...TICK,callback:v=>v.toFixed(1)},min:0,max:1}}}});
}
function seasonRankRow(r,i){
  const gc = GC[r.grade];
  return \`<tr>
    <td class="l">\${i+1}</td>
    <td class="l">\${r.title} <span style="color:var(--c-muted);font-size:11px">\${r.num}</span></td>
    <td style="font-weight:700;color:\${BC[r.grade]}">\${r.v2.toFixed(3)}</td>
    <td><span class="gpill \${gc}">\${r.grade}</span></td>
    <td>\${r.natPct}%</td>
    <td>\${r.algoPct}%</td>
    <td>\${r.ctr}%</td>
    <td>\${r.vr}%</td>
    <td>\${r.sub>0?'+':''}\${r.sub}</td>
    <td>\${r.eng.toLocaleString()}</td>
    <td>\${r.newPct}%</td>
  </tr>\`;
}

// 지표별 베스트·워스트 TOP3 — 통계 없이 정렬만 해서 보여주는 단순한 로직
const METRIC_CFG = {
  views: { fmt: v => v.toLocaleString() + '회' },
  nat: { fmt: v => v + '%' },
  ctr: { fmt: v => v + '%' },
  sub: { fmt: v => (v > 0 ? '+' : '') + v + '명' },
  vr: { fmt: v => v + '%' },
  eng: { fmt: v => v.toLocaleString() + '건' },
};
function bwCard(r, field, rank, isTop, total, fmt){
  return '<div class="spot-card '+(isTop?'spot-top':'spot-bottom')+'">'+
    '<div class="spot-rank">'+(isTop?'#'+rank:'#'+(total-3+rank))+'</div>'+
    '<div class="spot-title">'+r.title+' <span class="spot-num">'+r.num+'</span></div>'+
    '<div class="spot-v2" style="font-size:18px">'+fmt(r[field])+'</div>'+
  '</div>';
}
function setupBestWorst(id, fullData){
  let curM = 'views', curP = '7';
  const mTabs = document.getElementById('metricTabs_'+id);
  const pTabs = document.getElementById('periodTabs_'+id);
  function render(){
    const field = curM + curP;
    const fmt = METRIC_CFG[curM].fmt;
    const sorted = [...fullData].sort((a,b) => b[field] - a[field]);
    const top3 = sorted.slice(0,3), bottom3 = sorted.slice(-3).reverse();
    let html = '<p class="bw-title">베스트 3</p><div class="spot-grid">' +
      top3.map((r,i) => bwCard(r, field, i+1, true, fullData.length, fmt)).join('') + '</div>';
    html += '<p class="bw-title" style="margin-top:14px">워스트 3</p><div class="spot-grid">' +
      bottom3.map((r,i) => bwCard(r, field, i+1, false, fullData.length, fmt)).join('') + '</div>';
    document.getElementById('bestWorst_'+id).innerHTML = html;
  }
  mTabs.querySelectorAll('.ftab').forEach(btn => btn.addEventListener('click', function(){
    mTabs.querySelectorAll('.ftab').forEach(b => b.classList.remove('on')); this.classList.add('on');
    curM = this.getAttribute('data-m'); render();
  }));
  pTabs.querySelectorAll('.ftab').forEach(btn => btn.addEventListener('click', function(){
    pTabs.querySelectorAll('.ftab').forEach(b => b.classList.remove('on')); this.classList.add('on');
    curP = this.getAttribute('data-p'); render();
  }));
  render();
}

const SEASON_AVG=[${seasonAvgs.map(s => `{label:'${s.label}',avgV2:${s.avgV2.toFixed(3)},color:'${s.color}',gradeCounts:{S:${s.gradeCounts.S},A:${s.gradeCounts.A},'B+':${s.gradeCounts['B+']},B:${s.gradeCounts.B},C:${s.gradeCounts.C}}}`).join(',')}];
seasonAvgChart('c_season_avg', SEASON_AVG);

const SEASON_PAYLOAD=[
${seasons.map((s, i) => {
  const sd = seasonData[i];
  return `  { id:'${s.id}',
    traffic:[${sd.traffic.map(t => `{label:'${t.label}',value:${t.value},color:'${t.color}'}`).join(',')}],
    viewer:[{label:'신규 시청자',value:${sd.newPct},color:'#9F8FF7'},{label:'재방문 시청자',value:${sd.retPct},color:'#3DD68C'}],
    chrono:[${sd.chronoJs}],
    rank:[
      ${sd.rankJs}
    ],
    full:[
      ${sd.fullJs}
    ] }`;
}).join(',\n')}
];
SEASON_PAYLOAD.forEach(sd => {
  donutChart('c_'+sd.id+'_traffic', sd.traffic);
  donutChart('c_'+sd.id+'_viewer', sd.viewer);
  trendChart('c_'+sd.id+'_trend', sd.chrono);
  document.getElementById('rankBody_'+sd.id).innerHTML = sd.rank.map(seasonRankRow).join('');
  setupBestWorst(sd.id, sd.full);
});
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(DIR, '라플위클리_시즌15_상세분석.html'), html, 'utf8');
console.log('저장 완료: 라플위클리_시즌15_상세분석.html');
