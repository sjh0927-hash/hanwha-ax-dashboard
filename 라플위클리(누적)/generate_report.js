const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const results = JSON.parse(fs.readFileSync(path.join(DIR, 'weekly_cumulative_scored.json'), 'utf8'));

const SEASONS = ['위클리 시즌1', '위클리 시즌2', '위클리 시즌3', '위클리 시즌4', '위클리 시즌5', '위클리 시즌6'];
const SEASON_COLOR = {
  '위클리 시즌1': '#60A5FA',
  '위클리 시즌2': '#9F8FF7',
  '위클리 시즌3': '#F472B6',
  '위클리 시즌4': '#F5A623',
  '위클리 시즌5': '#34D399',
  '위클리 시즌6': '#22D3EE',
};

let pending = [];
try {
  pending = JSON.parse(fs.readFileSync(path.join(DIR, 'weekly_cumulative_pending.json'), 'utf8'));
} catch (e) { /* 없으면 무시 */ }

// VR 데이터가 있는지 여부(2-6화부터 5-14까지 전부 0 — 데이터 결측)
results.forEach(r => { r.vr_missing = !(r.vr_7d && r.vr_7d > 0); });

const chronological = [...results].sort((a, b) => {
  const sa = SEASONS.indexOf(a.season), sb = SEASONS.indexOf(b.season);
  if (sa !== sb) return sa - sb;
  return String(a.num).localeCompare(String(b.num), undefined, { numeric: true });
});

const bySeasonStats = SEASONS.map(s => {
  const arr = results.filter(r => r.season === s);
  const avg = arr.reduce((a, r) => a + r.v2, 0) / arr.length;
  const grades = { S: 0, A: 0, B: 0, C: 0 };
  arr.forEach(r => grades[r.grade]++);
  const vrMissingCount = arr.filter(r => r.vr_missing).length;
  return { season: s, count: arr.length, avg: +avg.toFixed(3), grades, vrMissingCount };
});

const totalCount = results.length;
const channelAvg = results.reduce((a, r) => a + r.v2, 0) / totalCount;
const gradeCounts = { S: 0, A: 0, B: 0, C: 0 };
results.forEach(r => gradeCounts[r.grade]++);
const bestSeason = [...bySeasonStats].sort((a, b) => b.avg - a.avg)[0];
const worstSeason = [...bySeasonStats].sort((a, b) => a.avg - b.avg)[0];
const vrMissingTotal = results.filter(r => r.vr_missing).length;

function esc(s) { return String(s).replace(/'/g, "\\'"); }

const dataArrJs = chronological.map(r => (
  `{season:'${esc(r.season)}',num:'${esc(r.num)}',title:'${esc(r.title)}',pub:'${r.pub_date || ''}',` +
  `v2:${r.v2},grade:'${r.grade}',natPct:${(r.nat_pct_7d * 100).toFixed(1)},natAbs:${Math.round(r.nat_abs_7d)},` +
  `vr:${(r.vr_7d * 100).toFixed(1)},vrMissing:${r.vr_missing},ctr:${(r.ctr_7d * 100).toFixed(2)},` +
  `sub:${Math.round(r.sub_7d)},views:${Math.round(r.views_7d)},eng:${Math.round(r.eng_7d)}}`
)).join(',\n  ');

const rankedArrJs = [...results].sort((a, b) => b.v2 - a.v2).map(r => (
  `{season:'${esc(r.season)}',num:'${esc(r.num)}',title:'${esc(r.title)}',pub:'${r.pub_date || ''}',` +
  `v2:${r.v2},grade:'${r.grade}',natPct:${(r.nat_pct_7d * 100).toFixed(1)},natAbs:${Math.round(r.nat_abs_7d)},` +
  `vr:${(r.vr_7d * 100).toFixed(1)},vrMissing:${r.vr_missing},ctr:${(r.ctr_7d * 100).toFixed(2)},sub:${Math.round(r.sub_7d)}}`
)).join(',\n  ');

const seasonLabels = bySeasonStats.map(s => `'${s.season.replace('위클리 ', '')}'`).join(',');
const seasonAvgs = bySeasonStats.map(s => s.avg).join(',');
const seasonColors = SEASONS.map(s => `'${SEASON_COLOR[s]}'`).join(',');
const seasonS = bySeasonStats.map(s => s.grades.S).join(',');
const seasonA = bySeasonStats.map(s => s.grades.A).join(',');
const seasonB = bySeasonStats.map(s => s.grades.B).join(',');
const seasonC = bySeasonStats.map(s => s.grades.C).join(',');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>라플위클리 누적 시즌 분석 — LTV Score</title>
<script>(function(){var t=localStorage.getItem('lp-theme');if(t==='light')document.documentElement.classList.add('light');})();</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<style>
:root {
  --c-bg:       #0E0F14;
  --c-surface:  #15161D;
  --c-card:     #1C1D27;
  --c-border:   rgba(255,255,255,0.07);
  --c-border2:  rgba(255,255,255,0.12);
  --c-text:     #F0EEF8;
  --c-muted:    #6E6D7A;
  --c-sub:      #9997A8;
  --c-purple:   #9F8FF7;
  --c-purple-d: #7F77DD;
  --c-purple-bg:#2A2445;
  --c-teal:     #3DD68C;
  --c-teal-d:   #1D9E75;
  --c-teal-bg:  #132B20;
  --c-amber:    #F5A623;
  --c-amber-bg: #2C1F08;
  --c-red:      #F05454;
  --c-red-bg:   #2C1010;
  --c-blue:     #60A5FA;
  --c-blue-bg:  #0F1F38;
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
}
*{box-sizing:border-box;margin:0;padding:0}
html{background:var(--c-bg)}
body{font-family:'SF Pro Display','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;background:var(--c-bg);color:var(--c-text);min-height:100vh;font-size:16px;line-height:1.5}
.shell{max-width:1100px;margin:0 auto;padding:0 24px 80px}
.page-header{padding:48px 0 32px;border-bottom:1px solid var(--c-border);margin-bottom:32px}
.header-eyebrow{font-size:13px;font-weight:500;letter-spacing:.12em;color:var(--c-purple);text-transform:uppercase;margin-bottom:10px}
.header-title{font-size:34px;font-weight:600;color:var(--c-text);letter-spacing:-.5px;margin-bottom:6px}
.header-sub{font-size:16px;color:var(--c-sub)}
.header-meta{display:flex;gap:20px;margin-top:20px;flex-wrap:wrap}
.meta-chip{font-size:14px;color:var(--c-muted);display:flex;align-items:center;gap:5px}
.meta-chip::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--c-purple);opacity:.7}
.warn-banner{background:linear-gradient(135deg,rgba(245,166,35,.1) 0%,rgba(240,84,84,.06) 100%);border:1px solid rgba(245,166,35,.3);border-radius:var(--r-lg);padding:18px 22px;margin-bottom:28px;font-size:14px;line-height:1.7;color:var(--c-sub)}
.warn-banner b{color:var(--c-amber)}
.kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px}
.kpi-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--r-md);padding:18px 20px;position:relative;overflow:hidden}
.kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.kpi-card.purple::before{background:var(--c-purple)}
.kpi-card.teal::before{background:var(--c-teal)}
.kpi-card.amber::before{background:var(--c-amber)}
.kpi-card.red::before{background:var(--c-red)}
.kpi-label{font-size:13px;color:var(--c-muted);letter-spacing:.04em;margin-bottom:8px;font-weight:500}
.kpi-val{font-size:26px;font-weight:600;letter-spacing:-.5px;line-height:1}
.kpi-val.purple{color:var(--c-purple)}
.kpi-val.teal{color:var(--c-teal)}
.kpi-val.amber{color:var(--c-amber)}
.kpi-val.red{color:var(--c-red)}
.kpi-badge{display:inline-block;font-size:12px;font-weight:500;padding:2px 7px;border-radius:20px;margin-top:7px;background:rgba(255,255,255,.07);color:var(--c-muted)}
.section{margin-bottom:36px}
.section-header{display:flex;align-items:baseline;gap:10px;margin-bottom:16px}
.section-title{font-size:17px;font-weight:600;color:var(--c-text)}
.section-desc{font-size:14px;color:var(--c-muted)}
.card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--r-lg);padding:20px 22px;margin-bottom:14px}
.card-title{font-size:15px;font-weight:600;color:var(--c-text);margin-bottom:3px}
.card-sub{font-size:13px;color:var(--c-muted);margin-bottom:14px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.formula-box{background:linear-gradient(135deg,rgba(159,143,247,.08) 0%,rgba(61,214,140,.05) 100%);border:1px solid rgba(159,143,247,.25);border-radius:var(--r-lg);padding:22px 24px;margin-bottom:24px;position:relative}
.formula-box::before{content:'LTV Score';position:absolute;top:-1px;left:24px;background:var(--c-purple);color:#fff;font-size:12px;font-weight:600;padding:0 8px;height:18px;line-height:18px;border-radius:0 0 4px 4px;letter-spacing:.06em}
.formula-line{font-family:'SF Mono','Fira Code',monospace;font-size:15px;line-height:2.1;color:var(--c-text)}
.formula-line .v{color:#C4B5FD;font-weight:600}
.formula-line .w{color:var(--c-teal);font-weight:600}
.formula-line .plus{color:var(--c-teal)}
.formula-line .minus{color:var(--c-red)}
.formula-line .cmt{font-family:inherit;font-size:13px;color:var(--c-muted)}
.formula-note{font-size:13px;color:var(--c-muted);margin-top:10px;padding-top:10px;border-top:1px solid var(--c-border);line-height:1.7}
.ep-tbl{width:100%;border-collapse:collapse}
.ep-tbl th{font-size:12px;font-weight:500;letter-spacing:.06em;color:var(--c-muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--c-border);text-transform:uppercase;white-space:nowrap}
.ep-tbl th.r{text-align:right}
.ep-tbl td{padding:9px 10px;border-bottom:1px solid var(--c-border);vertical-align:middle;font-size:14px}
.ep-tbl tr:last-child td{border-bottom:none}
.ep-tbl tr:hover td{background:rgba(255,255,255,.02)}
.ep-name{font-weight:500;color:var(--c-text)}
.ep-num{color:var(--c-muted);font-size:13px}
.tr{text-align:right;color:var(--c-sub);font-size:13px}
.gpill{font-size:12px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.05em}
.gs{background:var(--c-purple-bg);color:var(--c-purple)}
.ga{background:var(--c-teal-bg);color:var(--c-teal)}
.gb{background:var(--c-amber-bg);color:var(--c-amber)}
.gc{background:rgba(110,109,122,.15);color:var(--c-muted)}
.season-tag{font-size:12px;font-weight:500;padding:2px 7px;border-radius:5px;white-space:nowrap}
.vr-flag{font-size:11px;color:var(--c-amber);opacity:.85}
.filter-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.ftab{font-size:13px;font-weight:500;padding:5px 12px;border-radius:20px;border:1px solid var(--c-border);background:transparent;color:var(--c-muted);cursor:pointer;transition:all .15s}
.ftab.on{background:rgba(159,143,247,.12);color:var(--c-purple);border-color:rgba(159,143,247,.3)}
.chart-box{position:relative}
.tbl-scroll{overflow-x:auto}
.bench-tbl{width:100%;border-collapse:collapse;font-size:14px}
.bench-tbl th{font-size:12px;font-weight:500;color:var(--c-muted);letter-spacing:.05em;padding:8px 10px;border-bottom:1px solid var(--c-border);text-align:center}
.bench-tbl th.l{text-align:left}
.bench-tbl td{padding:9px 10px;border-bottom:1px solid var(--c-border);text-align:center;color:var(--c-sub)}
.bench-tbl td.l{text-align:left;font-weight:500;color:var(--c-text)}
.bench-tbl tr:last-child td{border-bottom:none}
.theme-btn{position:fixed;bottom:20px;right:20px;z-index:9999;width:38px;height:38px;border-radius:50%;border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.4);transition:border-color .15s,background .15s,box-shadow .15s;color:var(--c-muted);}
.theme-btn:hover{border-color:var(--c-purple);color:var(--c-text);}
html.light{--c-bg:#F5F6FA;--c-surface:#FFFFFF;--c-card:#FFFFFF;--c-border:rgba(0,0,0,0.09);--c-border2:rgba(0,0,0,0.15);--c-text:#1A1B26;--c-muted:#6E6D7A;--c-sub:#888898;--c-purple-bg:rgba(159,143,247,0.15);--c-teal-bg:rgba(61,214,140,0.12);--c-amber-bg:rgba(245,166,35,0.12);--c-red-bg:rgba(240,84,84,0.12);}
html.light .card{box-shadow:0 1px 4px rgba(0,0,0,.07);}
html.light .theme-btn{box-shadow:0 2px 12px rgba(0,0,0,.12);}
</style>
</head>
<body>
<div class="shell">

<header class="page-header">
  <p class="header-eyebrow">라플위클리 · 누적 시즌 분석 (별도 프로젝트)</p>
  <h1 class="header-title">라플위클리 누적 LTV Score</h1>
  <p class="header-sub">시즌1~6(진행중) 전편에 라플TV Score 공식(위클리 벤치마크)을 동일 적용</p>
  <div class="header-meta">
    <span class="meta-chip">총 ${totalCount}편 · 시즌1~6</span>
    <span class="meta-chip">발행 ${chronological[0].pub_date} ~ ${chronological[chronological.length - 1].pub_date}</span>
    <span class="meta-chip">채널 평균 LTV ${channelAvg.toFixed(2)}</span>
    ${pending.length ? `<span class="meta-chip">7D 집계대기 ${pending.length}편</span>` : ''}
  </div>
</header>

<div class="warn-banner">
  <b>⚠ 데이터 결측 안내 — VR(조회율) 지표</b><br>
  <b>시즌3~5 ${vrMissingTotal}편(전체의 ${Math.round(vrMissingTotal/totalCount*100)}%)</b>은 원본 엑셀에 평균 조회율(VR) 값이 0으로 비어 있습니다(시즌1·2·6은 정상 반영 완료).
  VR은 LTV Score에서 25% 비중을 차지하고 10% 미만이면 페널티(-0.025)까지 걸리는 항목이라, 이 구간의 점수는 실제보다 낮게 나올 수 있습니다 — 실제로 시즌2는 VR 보완 후 평균이 0.51→0.68로 뛰어 최고 시즌이 됐습니다.
  VR 데이터가 마저 채워지면 이 리포트는 재계산되어야 정확해집니다(표에 <span class="vr-flag">VR 결측</span> 표시로 구분).
  ${pending.length ? `<br>※ ${pending.map(p => `${p.season.replace('위클리 ','')} ${p.num} ${p.title}`).join(', ')}은(는) 발행 후 7일 데이터가 아직 안 쌓여 이번 집계에서 제외했습니다.` : ''}
</div>

<div class="kpi-strip">
  <div class="kpi-card purple">
    <p class="kpi-label">전체 평균 LTV</p>
    <p class="kpi-val purple">${channelAvg.toFixed(2)}</p>
    <span class="kpi-badge">시즌1~6, ${totalCount}편</span>
  </div>
  <div class="kpi-card teal">
    <p class="kpi-label">S / A 등급</p>
    <p class="kpi-val teal">${gradeCounts.S + gradeCounts.A}편</p>
    <span class="kpi-badge">S ${gradeCounts.S} · A ${gradeCounts.A}</span>
  </div>
  <div class="kpi-card amber">
    <p class="kpi-label">최고 평균 시즌</p>
    <p class="kpi-val amber">${bestSeason.season.replace('위클리 ', '')}</p>
    <span class="kpi-badge">평균 ${bestSeason.avg.toFixed(2)}</span>
  </div>
  <div class="kpi-card red">
    <p class="kpi-label">최저 평균 시즌</p>
    <p class="kpi-val red">${worstSeason.season.replace('위클리 ', '')}</p>
    <span class="kpi-badge">평균 ${worstSeason.avg.toFixed(2)} · VR결측 ${bySeasonStats.find(s=>s.season===worstSeason.season).vrMissingCount}편</span>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">시즌별 평균 LTV 추이</p>
    <p class="section-desc">시즌1→6, 막대 위 숫자 = 해당 시즌 평균 LTV Score</p>
  </div>
  <div class="card">
    <div class="chart-box" style="height:240px"><canvas id="c_season_avg"></canvas></div>
  </div>
</div>

<div class="grid-2 section">
  <div class="card">
    <p class="card-title">시즌별 등급 분포</p>
    <p class="card-sub">스택 바 · S/A/B/C</p>
    <div class="chart-box" style="height:220px"><canvas id="c_season_grade"></canvas></div>
  </div>
  <div class="card">
    <p class="card-title">전체 ${totalCount}편 LTV Score 분포</p>
    <p class="card-sub">발행 순 · 색상 = 시즌 · 점선 = 등급 경계</p>
    <div class="chart-box" style="height:220px"><canvas id="c_all_dist"></canvas></div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">전체 순위표</p>
    <p class="section-desc">LTV Score 내림차순 · VR 결측 구간은 참고용으로 표시</p>
  </div>
  <div class="filter-tabs">
    <button class="ftab on" onclick="filterSeason('all',this)">전체 ${totalCount}편</button>
    <button class="ftab" onclick="filterSeason('위클리 시즌1',this)">시즌1</button>
    <button class="ftab" onclick="filterSeason('위클리 시즌2',this)">시즌2</button>
    <button class="ftab" onclick="filterSeason('위클리 시즌3',this)">시즌3</button>
    <button class="ftab" onclick="filterSeason('위클리 시즌4',this)">시즌4</button>
    <button class="ftab" onclick="filterSeason('위클리 시즌5',this)">시즌5</button>
    <button class="ftab" onclick="filterSeason('위클리 시즌6',this)">시즌6</button>
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-scroll">
      <table class="ep-tbl">
        <thead><tr>
          <th>#</th><th>에피소드</th><th>시즌</th><th>발행일</th>
          <th class="r">LTV Score</th><th>등급</th>
          <th class="r">자연유입율</th><th class="r">자연유입(회)</th><th class="r">조회율(VR)</th><th class="r">CTR</th><th class="r">구독자</th>
        </tr></thead>
        <tbody id="rankBody"></tbody>
      </table>
    </div>
  </div>
</div>

<div class="section">
  <div class="formula-box">
    <div class="formula-line">
      <span class="v">LTV Score</span> = <span class="v">N</span><sub>자연유입</sub>×<span class="w">0.30</span>
       + <span class="v">N</span><sub>조회율</sub>×<span class="w">0.25</span>
       + <span class="v">N</span><sub>CTR</sub>×<span class="w">0.20</span>
       + <span class="v">N</span><sub>참여도</sub>×<span class="w">0.15</span>
       + <span class="v">N</span><sub>구독자</sub>×<span class="w">0.10</span>
    </div>
    <div class="formula-line">
      &nbsp;&nbsp;<span class="plus">+ 롱테일 보너스 +0.05</span>
      <span class="cmt">&nbsp;&nbsp;(자연유입 비중 ≥ 30%)</span>
    </div>
    <div class="formula-line">
      &nbsp;&nbsp;<span class="plus">+ 알고리즘/검색 보너스</span>
      <span class="cmt">&nbsp;&nbsp;추천동영상·탐색기능 / 검색 유입 비중 기반, 최대 +0.08</span>
    </div>
    <div class="formula-line">
      &nbsp;&nbsp;<span class="minus">− 복합 패널티 (조회율&lt;10% · 구독↓&lt;0 · CTR&lt;2% 각 −0.025)</span>
      <span class="cmt">&nbsp;&nbsp;최대 −0.05</span>
    </div>
    <p class="formula-note">
      라플TV Score(HOT&amp;NEW·딥다이브 포함 최신 리포트)와 동일한 위클리(w) 벤치마크를 그대로 적용: 자연유입비중 31.7%·자연유입 100,196회·조회율 18.4%·CTR 3.64%·참여도 2,500건·구독자 180명 (기대값의 2배가 만점 기준) &nbsp;|&nbsp;
      등급: S≥0.70, A 0.50~0.70, B 0.35~0.50, C&lt;0.35
    </p>
  </div>
</div>

</div><!-- /shell -->

<button id="theme-btn" class="theme-btn" onclick="(function(){var h=document.documentElement;var isLight=h.classList.toggle('light');localStorage.setItem('lp-theme',isLight?'light':'dark');document.getElementById('theme-btn').textContent=isLight?'🌙':'☀';})()">☀</button>

<script>
const GRID='rgba(255,255,255,0.06)', TICK={font:{size:10},color:'#6E6D7A'};
const BC={S:'#9F8FF7',A:'#3DD68C',B:'#F5A623',C:'#6E6D7A'};
const SEASON_COLOR={'위클리 시즌1':'#60A5FA','위클리 시즌2':'#9F8FF7','위클리 시즌3':'#F472B6','위클리 시즌4':'#F5A623','위클리 시즌5':'#34D399','위클리 시즌6':'#22D3EE'};
const SEASON_NAME={'위클리 시즌1':'S1','위클리 시즌2':'S2','위클리 시즌3':'S3','위클리 시즌4':'S4','위클리 시즌5':'S5','위클리 시즌6':'S6'};

const DATA=[
  ${dataArrJs}
];
const RANKED=[
  ${rankedArrJs}
];

Chart.defaults.color='#6E6D7A';

// 시즌별 평균 LTV
new Chart(document.getElementById('c_season_avg'),{type:'bar',
  data:{labels:[${seasonLabels}],
    datasets:[{data:[${seasonAvgs}],backgroundColor:[${seasonColors}],borderRadius:6,barPercentage:.55}]},
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
    tooltip:{callbacks:{label:c=>'평균 LTV '+c.parsed.y.toFixed(3)}}},
    scales:{x:{grid:{display:false},ticks:TICK},
            y:{grid:{color:GRID},ticks:{...TICK,callback:v=>v.toFixed(1)},min:0,max:.8}}}});

// 시즌별 등급분포
new Chart(document.getElementById('c_season_grade'),{type:'bar',
  data:{labels:[${seasonLabels}],
    datasets:[
      {label:'S',data:[${seasonS}],backgroundColor:'rgba(159,143,247,.8)',stack:'g',borderRadius:3},
      {label:'A',data:[${seasonA}],backgroundColor:'rgba(61,214,140,.8)',stack:'g',borderRadius:3},
      {label:'B',data:[${seasonB}],backgroundColor:'rgba(245,166,35,.7)',stack:'g',borderRadius:3},
      {label:'C',data:[${seasonC}],backgroundColor:'rgba(110,109,122,.4)',stack:'g',borderRadius:3},
    ]},
  options:{responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{font:{size:10},boxWidth:10,color:'#9997A8'}}},
    scales:{x:{stacked:true,grid:{display:false},ticks:TICK},y:{stacked:true,grid:{color:GRID},ticks:TICK}}}});

// 전체 분포 (발행순)
new Chart(document.getElementById('c_all_dist'),{type:'bar',
  data:{labels:DATA.map(d=>SEASON_NAME[d.season]+' '+d.num),
    datasets:[{data:DATA.map(d=>d.v2),
      backgroundColor:DATA.map(d=>SEASON_COLOR[d.season]+'BB'),
      borderColor:DATA.map(d=>SEASON_COLOR[d.season]),borderWidth:.5,borderRadius:3}]},
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
    tooltip:{callbacks:{title:c=>DATA[c[0].dataIndex].title,label:c=>'LTV '+c.parsed.y.toFixed(3)+(DATA[c[0].dataIndex].vrMissing?' (VR 결측)':'')}}},
    scales:{x:{grid:{display:false},ticks:{...TICK,maxRotation:60,font:{size:8},autoSkip:true,maxTicksLimit:20}},
            y:{grid:{color:GRID},ticks:{...TICK,callback:v=>v.toFixed(1)},min:0,max:1}}}});

/* 순위 테이블 */
let curSeason='all';
function filterSeason(s,btn){
  curSeason=s; document.querySelectorAll('.ftab').forEach(t=>t.classList.remove('on')); btn.classList.add('on'); renderRank();
}
function renderRank(){
  const list=curSeason==='all'?RANKED:RANKED.filter(d=>d.season===curSeason);
  const tbody=document.getElementById('rankBody'); tbody.innerHTML='';
  list.forEach((d,i)=>{
    const gc=d.grade==='S'?'gs':d.grade==='A'?'ga':d.grade==='B'?'gb':'gc';
    const tr=document.createElement('tr');
    tr.innerHTML=\`
      <td><span class="ep-num">\${i+1}</span></td>
      <td><span class="ep-name">\${d.title}</span> <span class="ep-num">\${d.num}</span></td>
      <td><span class="season-tag" style="background:\${SEASON_COLOR[d.season]}22;color:\${SEASON_COLOR[d.season]}">\${SEASON_NAME[d.season]}</span></td>
      <td class="ep-num">\${d.pub}</td>
      <td class="tr" style="font-weight:600;color:\${BC[d.grade]}">\${d.v2.toFixed(3)}</td>
      <td><span class="gpill \${gc}">\${d.grade}</span></td>
      <td class="tr">\${d.natPct}%</td>
      <td class="tr">\${d.natAbs.toLocaleString()}</td>
      <td class="tr">\${d.vrMissing?'<span class="vr-flag">결측</span>':d.vr+'%'}</td>
      <td class="tr">\${d.ctr}%</td>
      <td class="tr">\${d.sub>0?'+':''}\${d.sub}</td>\`;
    tbody.appendChild(tr);
  });
}
renderRank();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(DIR, '라플위클리_누적_시즌분석.html'), html, 'utf8');
console.log('저장 완료: 라플위클리_누적_시즌분석.html');
