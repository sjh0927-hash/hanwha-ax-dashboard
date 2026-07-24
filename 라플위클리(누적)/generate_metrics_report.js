const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const results = JSON.parse(fs.readFileSync(path.join(DIR, 'weekly_cumulative_scored.json'), 'utf8'));

const SEASONS = ['위클리 시즌1', '위클리 시즌2', '위클리 시즌3', '위클리 시즌4', '위클리 시즌5', '위클리 시즌6'];
const SEASON_COLOR = {
  '위클리 시즌1': '#60A5FA', '위클리 시즌2': '#9F8FF7', '위클리 시즌3': '#F472B6',
  '위클리 시즌4': '#F5A623', '위클리 시즌5': '#34D399', '위클리 시즌6': '#22D3EE',
};

function avg(arr, key) { return arr.reduce((a, r) => a + r[key], 0) / arr.length; }

const seasonStats = SEASONS.map(s => {
  const arr = results.filter(r => r.season === s);
  const vrArr = arr.filter(r => r.vr_7d && r.vr_7d > 0);
  const engArr = arr.filter(r => r.eng_7d && r.eng_7d > 0);
  const algoArr = arr.filter(r => r.algo_abs_7d && r.algo_abs_7d > 0);
  const srchArr = arr.filter(r => r.srch_abs_7d && r.srch_abs_7d > 0);
  return {
    season: s,
    count: arr.length,
    views: avg(arr, 'views_7d'),
    natPct: avg(arr, 'nat_pct_7d'),
    natAbs: avg(arr, 'nat_abs_7d'),
    ctr: avg(arr, 'ctr_7d'),
    vr: vrArr.length ? avg(vrArr, 'vr_7d') : null,
    vrCoverage: vrArr.length,
    sub: avg(arr, 'sub_7d'),
    eng: engArr.length ? avg(engArr, 'eng_7d') : null,
    watchMin: avg(arr, 'watch_min_7d'),
    algoPct: algoArr.length ? avg(algoArr, 'algo_pct_7d') : null,
    srchPct: srchArr.length ? avg(srchArr, 'srch_pct_7d') : null,
    nNat: avg(arr, 'nNat'),
    nVr: vrArr.length ? avg(vrArr, 'nVr') : 0,
    nCtr: avg(arr, 'nCtr'),
    nEng: engArr.length ? avg(engArr, 'nEng') : 0,
    nSub: avg(arr, 'nSub'),
    v2: avg(arr, 'v2'),
  };
});

// 지표별 자동 코멘트 — 데이터가 갱신돼도(시즌5 보완 등) 다시 이 스크립트를 돌리면
// 숫자와 코멘트가 함께 재계산되도록 하드코딩 대신 seasonStats에서 직접 도출한다.
const shortName = s => s.replace('위클리 ', '');
function hasBatchim(str) {
  const code = str.charCodeAt(str.length - 1);
  if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 !== 0;
  return false; // 한글이 아닌 문자(%, K 등)는 관용적으로 '로' 사용
}
const ro = unit => hasBatchim(unit) ? '으로' : '로';
const iga = word => hasBatchim(word) ? '이' : '가';
const eunNeun = word => hasBatchim(word) ? '은' : '는';
function describeTrend(field, { unit = '', fmt = v => v, higherIsBetter = true } = {}) {
  const valid = seasonStats.filter(s => s[field] != null);
  const missing = seasonStats.filter(s => s[field] == null);
  if (valid.length < 2) return '비교할 유효 데이터가 2개 시즌 미만이라 추세를 판단하기 어렵습니다.';

  const first = valid[0], last = valid[valid.length - 1];
  const best = [...valid].sort((a, b) => b[field] - a[field])[0];
  const worst = [...valid].sort((a, b) => a[field] - b[field])[0];
  const change = last[field] - first[field];
  const threshold = Math.abs(first[field]) * 0.05;

  let dirWord;
  if (Math.abs(change) <= threshold) dirWord = '큰 변화 없이 횡보';
  else if ((change > 0) === higherIsBetter) dirWord = '개선';
  else dirWord = '하락';

  let text = `${shortName(first.season)} ${fmt(first[field])}${unit} → ${shortName(last.season)} ${fmt(last[field])}${unit}${ro(unit)} ${dirWord}`;
  text += ` · 최고 ${shortName(best.season)}(${fmt(best[field])}${unit}) · 최저 ${shortName(worst.season)}(${fmt(worst[field])}${unit})`;
  if (missing.length) {
    text += ` · ${missing.map(m => shortName(m.season)).join('·')}는 데이터 결측으로 추세 판단에서 제외`;
  }
  return text;
}

const insights = {
  views: describeTrend('views', { fmt: v => Math.round(v/1000).toLocaleString()+'K' }),
  natPct: describeTrend('natPct', { unit: '%', fmt: v => (v*100).toFixed(1) }),
  ctr: describeTrend('ctr', { unit: '%', fmt: v => (v*100).toFixed(2) }),
  vr: describeTrend('vr', { unit: '%', fmt: v => (v*100).toFixed(1) }),
  sub: describeTrend('sub', { unit: '명', fmt: v => Math.round(v).toLocaleString() }),
  eng: describeTrend('eng', { unit: '건', fmt: v => Math.round(v).toLocaleString() }),
};

// 참여도 세부 분석 — 좋아요/공유/댓글 중 어떤 게 가장 유의미한지 상관관계로 확인.
// 참여도 데이터가 있는 편(시즌1·2·3·4·6, eng_7d>0)만 대상으로 계산.
function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; num += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  return num / Math.sqrt(dx2 * dy2);
}
const engValid = results.filter(r => r.eng_7d && r.eng_7d > 0);
const ENG_SUBMETRICS = [
  { key: 'likes_7d', label: '좋아요' },
  { key: 'shares_7d', label: '공유' },
  { key: 'comments_7d', label: '댓글' },
];
const ENG_TARGETS = [
  { key: 'v2', label: 'LTV Score' },
  { key: 'sub_7d', label: '구독자증감' },
  { key: 'nat_pct_7d', label: '자연유입비중' },
  { key: 'views_7d', label: '조회수' },
];
const engCorr = ENG_SUBMETRICS.map(m => {
  const xs = engValid.map(r => r[m.key]);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  const corrs = ENG_TARGETS.map(t => ({ target: t.label, r: pearson(xs, engValid.map(r => r[t.key])) }));
  const avgR = corrs.reduce((a, c) => a + c.r, 0) / corrs.length;
  return { ...m, mean, cv: sd / mean, corrs, avgR };
});
const bestEngMetric = [...engCorr].sort((a, b) => b.avgR - a.avgR)[0];
const worstEngMetric = [...engCorr].sort((a, b) => a.avgR - b.avgR)[0];
const mostVolatileEngMetric = [...engCorr].sort((a, b) => b.cv - a.cv)[0];

// 핵심 관찰 — 결측 없이 전 시즌 정상인 지표(조회수·자연유입·CTR·구독자) 중 변화폭이 가장 큰
// 것을 자동으로 뽑아 헤드라인으로 제시. 구독자 증감은 결측 영향이 전혀 없는 유일한 "순수" 하락
// 신호라 항상 별도로 짚어준다.
const first = seasonStats[0], last = seasonStats[seasonStats.length - 1];
const subChangePct = ((last.sub - first.sub) / Math.abs(first.sub)) * 100;
const cleanMetrics = [
  { key: 'views', label: '조회수', v0: first.views, v1: last.views },
  { key: 'natPct', label: '자연유입 비중', v0: first.natPct, v1: last.natPct },
  { key: 'ctr', label: 'CTR', v0: first.ctr, v1: last.ctr },
];
const biggestSwing = [...cleanMetrics].sort((a, b) =>
  Math.abs((b.v1 - b.v0) / Math.abs(b.v0)) - Math.abs((a.v1 - a.v0) / Math.abs(a.v0))
)[0];
const biggestSwingPct = ((biggestSwing.v1 - biggestSwing.v0) / Math.abs(biggestSwing.v0)) * 100;

const keyObservations = [
  `<b>구독자 증감이 시즌1→시즌6 사이 ${subChangePct > 0 ? '+' : ''}${subChangePct.toFixed(0)}% 변화</b>(${Math.round(first.sub).toLocaleString()}명 → ${Math.round(last.sub).toLocaleString()}명) — 결측 지표 영향이 전혀 없는 순수 관찰치라 가장 신뢰도 높은 신호입니다.`,
  `<b>${biggestSwing.label}</b>${iga(biggestSwing.label)} 전 시즌 정상 반영된 지표 중 변화폭이 가장 큽니다(시즌1 대비 ${biggestSwingPct > 0 ? '+' : ''}${biggestSwingPct.toFixed(0)}%).`,
];
const missingSeasons = seasonStats.filter(s => s.vrCoverage < s.count).map(s => shortName(s.season));
if (missingSeasons.length) {
  keyObservations.push(`조회율(VR)·참여도·트래픽소스는 ${missingSeasons.join('·')} 결측 구간이 있어, 이 세 지표의 "추세"는 나머지 시즌만으로 판단 — 데이터가 채워지기 전까지는 잠정 해석으로 볼 것.`);
}

const totalCount = results.length;
const firstPub = [...results].sort((a, b) => new Date(a.pub_date) - new Date(b.pub_date))[0].pub_date;
const lastPub = [...results].sort((a, b) => new Date(b.pub_date) - new Date(a.pub_date))[0].pub_date;

const seasonLabelsJs = seasonStats.map(s => `'${s.season.replace('위클리 ', '')}'`).join(',');
const seasonColorsJs = SEASONS.map(s => `'${SEASON_COLOR[s]}'`).join(',');

function seriesJs(field, round) {
  return seasonStats.map(s => s[field] == null ? 'null' : (round ? Math.round(s[field] * round) / round : s[field])).join(',');
}

const radarDatasets = seasonStats.map(s => (
  `{label:'${s.season.replace('위클리 ', '')}',data:[${s.nNat.toFixed(3)},${s.nVr.toFixed(3)},${s.nCtr.toFixed(3)},${s.nEng.toFixed(3)},${s.nSub.toFixed(3)}],` +
  `borderColor:'${SEASON_COLOR[s.season]}',backgroundColor:'${SEASON_COLOR[s.season]}22',pointRadius:2,borderWidth:1.5}`
)).join(',\n      ');

function esc(s) { return String(s).replace(/'/g, "\\'"); }

const tableRowsJs = seasonStats.map(s => (
  `{season:'${esc(s.season)}',count:${s.count},views:${Math.round(s.views)},natPct:${(s.natPct*100).toFixed(1)},` +
  `natAbs:${Math.round(s.natAbs)},ctr:${(s.ctr*100).toFixed(2)},vr:${s.vr==null?'null':(s.vr*100).toFixed(1)},` +
  `vrCoverage:${s.vrCoverage},sub:${Math.round(s.sub)},eng:${s.eng==null?'null':Math.round(s.eng)},watchMin:${s.watchMin.toFixed(1)},` +
  `algoPct:${s.algoPct==null?'null':(s.algoPct*100).toFixed(1)},srchPct:${s.srchPct==null?'null':(s.srchPct*100).toFixed(1)},v2:${s.v2.toFixed(3)}}`
)).join(',\n  ');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>라플위클리 시즌별 지표 비교</title>
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
.warn-banner{background:linear-gradient(135deg,rgba(245,166,35,.1) 0%,rgba(240,84,84,.06) 100%);border:1px solid rgba(245,166,35,.3);border-radius:var(--r-lg);padding:16px 22px;margin-bottom:28px;font-size:13px;line-height:1.7;color:var(--c-sub)}
.warn-banner b{color:var(--c-amber)}
.section{margin-bottom:36px}
.section-header{display:flex;align-items:baseline;gap:10px;margin-bottom:16px}
.section-title{font-size:17px;font-weight:600;color:var(--c-text)}
.section-desc{font-size:14px;color:var(--c-muted)}
.card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--r-lg);padding:20px 22px;margin-bottom:14px}
.card-title{font-size:15px;font-weight:600;color:var(--c-text);margin-bottom:3px}
.card-sub{font-size:13px;color:var(--c-muted);margin-bottom:14px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.chart-box{position:relative}
.tbl-scroll{overflow-x:auto}
.mtx-tbl{width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap}
.mtx-tbl th{font-size:11px;font-weight:500;color:var(--c-muted);letter-spacing:.04em;padding:8px 10px;border-bottom:1px solid var(--c-border);text-align:right}
.mtx-tbl th.l{text-align:left}
.mtx-tbl td{padding:9px 10px;border-bottom:1px solid var(--c-border);text-align:right;color:var(--c-sub)}
.mtx-tbl td.l{text-align:left;font-weight:600;color:var(--c-text)}
.mtx-tbl tr:last-child td{border-bottom:none}
.vr-flag{font-size:11px;color:var(--c-amber);opacity:.9}
.insight-text{font-size:12px;color:var(--c-sub);line-height:1.6;margin-top:10px;padding-top:10px;border-top:1px solid var(--c-border)}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px}
.leg{display:flex;align-items:center;gap:5px;font-size:13px;color:var(--c-muted)}
.leg-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0}
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
  <p class="header-eyebrow">라플위클리 · 시즌별 지표 비교 (별도 프로젝트)</p>
  <h1 class="header-title">시즌1~6 지표 비교</h1>
  <p class="header-sub">LTV Score를 구성하는 원본 지표들을 시즌 단위로 직접 비교</p>
  <div class="header-meta">
    <span class="meta-chip">총 ${totalCount}편 · 시즌1~6</span>
    <span class="meta-chip">발행 ${firstPub} ~ ${lastPub}</span>
  </div>
</header>

${missingSeasons.length ? `<div class="warn-banner">
  <b>⚠ ${missingSeasons.join('·')} 데이터 결측 — VR뿐 아니라 참여도·트래픽소스도 전부 0</b><br>
  ${missingSeasons.join('·')}는 <b>조회율(VR)·참여도(좋아요+공유+댓글)·트래픽소스(알고리즘/검색 유입)</b> 3개 지표가 원본 엑셀에 전부 0으로 비어 있습니다. 아래 표·차트에서 이 시즌의 VR·참여도·알고리즘/검색유입 값은 실제 성과가 아니라 결측을 그대로 보여주는 것이니 참고만 하세요(VR은 <span class="vr-flag">결측</span> 표시, 참여도·알고리즘·검색은 0으로 표시됨). 조회수·자연유입·CTR·구독자·시청시간은 전 시즌 정상 반영.
</div>` : ''}

<div class="section">
  <div class="card">
    <p class="card-title">핵심 관찰</p>
    <p class="card-sub">시즌1→6 전체 흐름에서 자동으로 짚은 변화 포인트</p>
    <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--c-sub);line-height:1.6">
      ${keyObservations.map(o => `<li>${o}</li>`).join('\n      ')}
    </ul>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">시즌별 원본 지표 매트릭스</p>
    <p class="section-desc">전편 평균(7D 기준) · 시즌 단위 비교</p>
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-scroll">
      <table class="mtx-tbl">
        <thead><tr>
          <th class="l">시즌</th><th>편수</th><th>조회수</th><th>자연유입율</th><th>자연유입(회)</th>
          <th>CTR</th><th>조회율(VR)</th><th>구독자증감</th><th>참여도</th><th>평균시청(분)</th>
          <th>알고리즘유입</th><th>검색유입</th><th>평균 LTV</th>
        </tr></thead>
        <tbody id="mtxBody"></tbody>
      </table>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">지표별 시즌 추이</p>
    <p class="section-desc">시즌1→6, 지표별 평균값</p>
  </div>
  <div class="grid-3">
    <div class="card">
      <p class="card-title">평균 조회수(7D)</p>
      <div class="chart-box" style="height:170px"><canvas id="c_views"></canvas></div>
      <p class="insight-text">${insights.views}</p>
    </div>
    <div class="card">
      <p class="card-title">자연유입 비중</p>
      <div class="chart-box" style="height:170px"><canvas id="c_natpct"></canvas></div>
      <p class="insight-text">${insights.natPct}</p>
    </div>
    <div class="card">
      <p class="card-title">평균 CTR</p>
      <div class="chart-box" style="height:170px"><canvas id="c_ctr"></canvas></div>
      <p class="insight-text">${insights.ctr}</p>
    </div>
    <div class="card">
      <p class="card-title">평균 조회율(VR)</p>
      ${missingSeasons.length ? `<p class="card-sub" style="margin-bottom:4px;font-size:11px">${missingSeasons.join('·')} 결측 — 막대 없음</p>` : ''}
      <div class="chart-box" style="height:150px"><canvas id="c_vr"></canvas></div>
      <p class="insight-text">${insights.vr}</p>
    </div>
    <div class="card">
      <p class="card-title">평균 구독자 증감</p>
      <div class="chart-box" style="height:170px"><canvas id="c_sub"></canvas></div>
      <p class="insight-text">${insights.sub}</p>
    </div>
    <div class="card">
      <p class="card-title">평균 참여도(좋아요+공유+댓글)</p>
      <div class="chart-box" style="height:170px"><canvas id="c_eng"></canvas></div>
      <p class="insight-text">${insights.eng}</p>
    </div>
  </div>
</div>

<div class="section">
  <div class="card">
    <p class="card-title">참여도 세부 분석 — 좋아요·공유·댓글, 뭐가 제일 유의미할까</p>
    <p class="card-sub">참여도 데이터가 있는 ${engValid.length === totalCount ? '전체 ' + totalCount + '편' : engValid.length + '편'} 대상 · 피어슨 상관계수(r)</p>
    <div class="tbl-scroll">
      <table class="mtx-tbl">
        <thead><tr>
          <th class="l">구분</th><th>LTV Score</th><th>구독자증감</th><th>자연유입비중</th><th>조회수</th><th>평균값</th><th>변동계수</th>
        </tr></thead>
        <tbody>
          ${engCorr.map(m => `<tr>
            <td class="l">${m.label}${m.key===bestEngMetric.key?' <span style="color:var(--c-teal);font-size:11px">★최고 신호</span>':''}${m.key===mostVolatileEngMetric.key?' <span class="vr-flag">변동성 최대</span>':''}</td>
            ${m.corrs.map(c => `<td style="${c.r===Math.max(...engCorr.map(e=>e.corrs.find(x=>x.target===c.target).r))?'color:var(--c-purple);font-weight:700':''}">${c.r.toFixed(3)}</td>`).join('')}
            <td>${m.mean.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
            <td>${m.cv.toFixed(2)}</td>
          </tr>`).join('\n          ')}
        </tbody>
      </table>
    </div>
    <p class="insight-text">
      <b>${bestEngMetric.label}</b>가 4개 지표 평균 상관계수 ${bestEngMetric.avgR.toFixed(3)}로 가장 유의미한 참여 신호입니다(특히 LTV Score와 r=${bestEngMetric.corrs.find(c=>c.target==='LTV Score').r.toFixed(3)}).
      <b>${mostVolatileEngMetric.label}</b>는 변동계수 ${mostVolatileEngMetric.cv.toFixed(2)}로 편차가 가장 커서, 평균적인 성과보다는 "터지는" 소수 에피소드를 조기에 잡아내는 바이럴 신호로 보는 게 적합합니다.
      <b>${worstEngMetric.label}</b>${eunNeun(worstEngMetric.label)} 평균 상관계수 ${worstEngMetric.avgR.toFixed(3)}로 세 지표 중 가장 약한 신호라, 위클리 포맷에서는 참여도 판단의 보조 지표로만 활용을 권장합니다.
    </p>
  </div>
</div>

<div class="section">
  <div class="card">
    <p class="card-title">시즌별 정규화 지표 레이더</p>
    <p class="card-sub">라플TV Score 5개 구성요소(자연유입·조회율·CTR·참여도·구독자)를 위클리 벤치마크 기준으로 정규화${missingSeasons.length ? ` · ${missingSeasons.join('·')}는 조회율 축 0으로 표시(결측)` : ''}</p>
    <div class="legend">
      ${seasonStats.map(s => `<span class="leg"><span class="leg-dot" style="background:${SEASON_COLOR[s.season]}"></span>${s.season.replace('위클리 ','')}</span>`).join('\n      ')}
    </div>
    <div class="chart-box" style="height:320px"><canvas id="c_radar"></canvas></div>
  </div>
</div>

</div><!-- /shell -->

<button id="theme-btn" class="theme-btn" onclick="(function(){var h=document.documentElement;var isLight=h.classList.toggle('light');localStorage.setItem('lp-theme',isLight?'light':'dark');document.getElementById('theme-btn').textContent=isLight?'🌙':'☀';})()">☀</button>

<script>
const GRID='rgba(255,255,255,0.06)', TICK={font:{size:10},color:'#6E6D7A'};
const LABELS=[${seasonLabelsJs}];
const COLORS=[${seasonColorsJs}];

const ROWS=[
  ${tableRowsJs}
];

function fmtRow(r){
  return \`<tr>
    <td class="l">\${r.season.replace('위클리 ','')} <span style="color:var(--c-muted);font-weight:400">(\${r.count}편)</span></td>
    <td>\${r.count}</td>
    <td>\${r.views.toLocaleString()}</td>
    <td>\${r.natPct}%</td>
    <td>\${r.natAbs.toLocaleString()}</td>
    <td>\${r.ctr}%</td>
    <td>\${r.vr===null?'<span class="vr-flag">결측</span>':r.vr+'%'}</td>
    <td>\${r.sub>0?'+':''}\${r.sub}</td>
    <td>\${r.eng===null?'<span class="vr-flag">결측</span>':r.eng.toLocaleString()}</td>
    <td>\${r.watchMin}</td>
    <td>\${r.algoPct===null?'<span class="vr-flag">결측</span>':r.algoPct+'%'}</td>
    <td>\${r.srchPct===null?'<span class="vr-flag">결측</span>':r.srchPct+'%'}</td>
    <td style="color:var(--c-purple);font-weight:600">\${r.v2}</td>
  </tr>\`;
}
document.getElementById('mtxBody').innerHTML = ROWS.map(fmtRow).join('');

Chart.defaults.color='#6E6D7A';

function simpleBar(id, data, fmt, color){
  new Chart(document.getElementById(id),{type:'bar',
    data:{labels:LABELS, datasets:[{data:data, backgroundColor:COLORS, borderRadius:6, barPercentage:.6}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>c.parsed.y==null?'결측':fmt(c.parsed.y)}}},
      scales:{x:{grid:{display:false},ticks:TICK},
              y:{grid:{color:GRID},ticks:{...TICK,callback:v=>fmt(v)}}}}});
}

simpleBar('c_views', ROWS.map(r=>r.views), v=>Math.round(v/1000)+'K');
simpleBar('c_natpct', ROWS.map(r=>r.natPct), v=>v.toFixed(0)+'%');
simpleBar('c_ctr', ROWS.map(r=>r.ctr), v=>v.toFixed(1)+'%');
simpleBar('c_vr', ROWS.map(r=>r.vr===null?null:+r.vr), v=>v.toFixed(0)+'%');
simpleBar('c_sub', ROWS.map(r=>r.sub), v=>Math.round(v));
simpleBar('c_eng', ROWS.map(r=>r.eng), v=>Math.round(v));

// 레이더
new Chart(document.getElementById('c_radar'),{type:'radar',
  data:{labels:['자연유입','조회율','CTR','참여도','구독자'],
    datasets:[
      ${radarDatasets}
    ]},
  options:{responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false}},
    scales:{r:{min:0,max:1,ticks:{font:{size:9},stepSize:.25,backdropColor:'transparent'},
      grid:{color:GRID},pointLabels:{font:{size:11},color:'#9997A8'},
      angleLines:{color:GRID}}}}});
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(DIR, '라플위클리_시즌별_지표비교.html'), html, 'utf8');
console.log('저장 완료: 라플위클리_시즌별_지표비교.html');
