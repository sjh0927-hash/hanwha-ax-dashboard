const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const raw = JSON.parse(fs.readFileSync(path.join(DIR, 'weekly_cumulative_data.json'), 'utf8').replace(/^﻿/, ''));
const baseline = JSON.parse(fs.readFileSync(path.join(DIR, 'weekly_cumulative_scored.json'), 'utf8'));

const BENCH_W = { nat_pct: 0.317, nat_abs: 100196, vr: 0.184, ctr: 0.0364, eng: 2500, sub: 180 };
const WEIGHTS_7D = { nat: 0.30, vr: 0.25, ctr: 0.20, eng: 0.15, sub: 0.10 };

function N(v, bench) {
  if (v == null || isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v / (bench * 2)));
}

// natMix: [유입율 가중치, 절대값 가중치] — 기존 공식(calc_ltv.js)은 [0.5,0.5] 고정.
function calcScore7d(ep, natMix) {
  const nNatPct = N(ep.nat_pct_7d, BENCH_W.nat_pct);
  const nNatAbs = N(ep.nat_abs_7d, BENCH_W.nat_abs);
  const nNat = nNatPct * natMix[0] + nNatAbs * natMix[1];
  const nVr = N(ep.vr_7d, BENCH_W.vr);
  const nCtr = N(ep.ctr_7d, BENCH_W.ctr);
  const nEng = N(ep.eng_7d, BENCH_W.eng);
  const nSub = N(ep.sub_7d, BENCH_W.sub);
  const base = nNat * WEIGHTS_7D.nat + nVr * WEIGHTS_7D.vr + nCtr * WEIGHTS_7D.ctr + nEng * WEIGHTS_7D.eng + nSub * WEIGHTS_7D.sub;
  const b_org = ep.nat_pct_7d >= BENCH_W.nat_pct ? 0.05 : 0;
  const b_algo = Math.min(0.05, (ep.algo_pct_7d || 0) * 0.5);
  const b_srch = Math.min(0.03, (ep.srch_pct_7d || 0) * 0.6);
  let pen = 0;
  if (ep.vr_7d > 0 && ep.vr_7d < BENCH_W.vr / 2) pen += 0.025;
  if (ep.sub_7d < 0) pen += 0.025;
  if (ep.ctr_7d < BENCH_W.ctr / 2) pen += 0.025;
  pen = Math.min(0.05, pen);
  return +(base + b_org + b_algo + b_srch - pen).toFixed(3);
}
function percentileCut(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const q = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return { p90: q(0.90), p65: q(0.65), p35: q(0.35), p10: q(0.10) };
}
function gradeFromCut(v2, cut) {
  if (v2 >= cut.p90) return 'S';
  if (v2 >= cut.p65) return 'A';
  if (v2 >= cut.p35) return 'B+';
  if (v2 >= cut.p10) return 'B';
  return 'C';
}

const argPct = parseFloat(process.argv[2]);
const argAbs = parseFloat(process.argv[3]);
const NAT_MIX = (!isNaN(argPct) && !isNaN(argAbs)) ? [argPct, argAbs] : [0.3, 0.7];
const mixLabel = `${Math.round(NAT_MIX[0] * 10)}:${Math.round(NAT_MIX[1] * 10)}`;
const mixFileLabel = `${Math.round(NAT_MIX[0] * 10)}대${Math.round(NAT_MIX[1] * 10)}`;
const simScore = new Map(raw.map(ep => [ep.season + ep.num, calcScore7d(ep, NAT_MIX)]));
const simCut = percentileCut([...simScore.values()]);

const rankBase = [...baseline].sort((a, b) => b.v2 - a.v2);
const rankBaseOf = new Map(rankBase.map((r, i) => [r.season + r.num, i + 1]));
const simList = baseline.map(r => ({ key: r.season + r.num, v2Sim: simScore.get(r.season + r.num) }));
const rankSimList = [...simList].sort((a, b) => b.v2Sim - a.v2Sim);
const rankSimOf = new Map(rankSimList.map((r, i) => [r.key, i + 1]));

const rows = baseline.map(r => {
  const key = r.season + r.num;
  const v2Sim = simScore.get(key);
  const gradeSim = gradeFromCut(v2Sim, simCut);
  const rb = rankBaseOf.get(key), rs = rankSimOf.get(key);
  return {
    season: r.season, num: r.num, title: r.title, rb, rs, delta: rb - rs,
    v2Base: r.v2, v2Sim, deltaScore: +(v2Sim - r.v2).toFixed(3),
    gradeBase: r.grade, gradeSim, gradeChanged: r.grade !== gradeSim,
    natPct: r.nat_pct_7d, natAbs: r.nat_abs_7d,
  };
}).sort((a, b) => a.rb - b.rb);

const gradeChangedCount = rows.filter(r => r.gradeChanged).length;
const top10BaseKeys = new Set(rankBase.slice(0, 10).map(r => r.season + r.num));
const top10SimKeys = new Set(rankSimList.slice(0, 10).map(r => r.key));
let top10Overlap = 0; top10BaseKeys.forEach(k => { if (top10SimKeys.has(k)) top10Overlap++; });
const avgAbsDelta = rows.reduce((a, r) => a + Math.abs(r.deltaScore), 0) / rows.length;
const maxAbsRankDelta = Math.max(...rows.map(r => Math.abs(r.delta)));
const topMovers = [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 15);

function esc(s) { return String(s).replace(/'/g, "\\'"); }
function rowJs(r) {
  return `{rb:${r.rb},rs:${r.rs},delta:${r.delta},season:'${esc(r.season)}',num:'${esc(r.num)}',title:'${esc(r.title)}',` +
    `v2Base:${r.v2Base},v2Sim:${r.v2Sim},deltaScore:${r.deltaScore},gradeBase:'${r.gradeBase}',gradeSim:'${r.gradeSim}',` +
    `gradeChanged:${r.gradeChanged},natPct:${(r.natPct * 100).toFixed(1)},natAbs:${Math.round(r.natAbs)}}`;
}
const rowsJs = rows.map(rowJs).join(',\n  ');
const moverLabels = topMovers.map(r => `'${r.season.replace('위클리 ', '')} ${r.num}'`).join(',');
const moverDeltas = topMovers.map(r => r.delta).join(',');
const moverColors = topMovers.map(r => r.delta > 0 ? "'#3DD68C'" : "'#F05454'").join(',');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>라플위클리 자연유입 가중치 시뮬레이션 — 5:5 vs ${mixLabel}</title>
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
  --c-purple-bg:#2A2445;
  --c-teal:     #3DD68C;
  --c-teal-bg:  #132B20;
  --c-amber:    #F5A623;
  --c-amber-bg: #2C1F08;
  --c-red:      #F05454;
  --c-red-bg:   #2C1010;
  --c-blue:     #60A5FA;
  --c-blue-bg:  #0F1F38;
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px;
}
*{box-sizing:border-box;margin:0;padding:0}
html{background:var(--c-bg)}
body{font-family:'SF Pro Display','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;background:var(--c-bg);color:var(--c-text);min-height:100vh;font-size:16px;line-height:1.5}
.shell{max-width:1100px;margin:0 auto;padding:0 24px 80px}
.page-header{padding:48px 0 32px;border-bottom:1px solid var(--c-border);margin-bottom:32px}
.header-eyebrow{font-size:13px;font-weight:500;letter-spacing:.12em;color:var(--c-purple);text-transform:uppercase;margin-bottom:10px}
.header-title{font-size:30px;font-weight:600;color:var(--c-text);letter-spacing:-.5px;margin-bottom:6px}
.header-sub{font-size:16px;color:var(--c-sub)}
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
.kpi-val.purple{color:var(--c-purple)} .kpi-val.teal{color:var(--c-teal)} .kpi-val.amber{color:var(--c-amber)} .kpi-val.red{color:var(--c-red)}
.kpi-badge{display:inline-block;font-size:12px;font-weight:500;padding:2px 7px;border-radius:20px;margin-top:7px;background:rgba(255,255,255,.07);color:var(--c-muted)}
.section{margin-bottom:36px}
.section-header{display:flex;align-items:baseline;gap:10px;margin-bottom:16px}
.section-title{font-size:17px;font-weight:600;color:var(--c-text)}
.section-desc{font-size:14px;color:var(--c-muted)}
.card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--r-lg);padding:20px 22px;margin-bottom:14px}
.card-title{font-size:15px;font-weight:600;color:var(--c-text);margin-bottom:3px}
.card-sub{font-size:13px;color:var(--c-muted);margin-bottom:14px}
.chart-box{position:relative}
.filter-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.ftab{font-size:13px;font-weight:500;padding:5px 12px;border-radius:20px;border:1px solid var(--c-border);background:transparent;color:var(--c-muted);cursor:pointer;transition:all .15s}
.ftab.on{background:rgba(159,143,247,.12);color:var(--c-purple);border-color:rgba(159,143,247,.3)}
.tbl-scroll{overflow-x:auto}
.ep-tbl{width:100%;border-collapse:collapse}
.ep-tbl th{font-size:12px;font-weight:500;letter-spacing:.06em;color:var(--c-muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--c-border);text-transform:uppercase;white-space:nowrap}
.ep-tbl th.r{text-align:right}
.ep-tbl td{padding:9px 10px;border-bottom:1px solid var(--c-border);vertical-align:middle;font-size:14px}
.ep-tbl tr:last-child td{border-bottom:none}
.ep-tbl tr:hover td{background:rgba(255,255,255,.02)}
.ep-tbl tr.changed td{background:rgba(245,166,35,.05)}
.ep-name{font-weight:500;color:var(--c-text)}
.ep-num{color:var(--c-muted);font-size:13px}
.tr{text-align:right;color:var(--c-sub);font-size:13px}
.gpill{font-size:12px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.05em}
.gs{background:var(--c-purple-bg);color:var(--c-purple)}
.ga{background:var(--c-teal-bg);color:var(--c-teal)}
.gbp{background:var(--c-amber-bg);color:var(--c-amber)}
.gb{background:var(--c-blue-bg);color:var(--c-blue)}
.gc{background:rgba(110,109,122,.15);color:var(--c-muted)}
.season-tag{font-size:12px;font-weight:500;padding:2px 7px;border-radius:5px;white-space:nowrap}
.theme-btn{position:fixed;bottom:20px;right:20px;z-index:9999;width:38px;height:38px;border-radius:50%;border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.4);transition:border-color .15s,background .15s,box-shadow .15s;color:var(--c-muted);}
.theme-btn:hover{border-color:var(--c-purple);color:var(--c-text);}
html.light{--c-bg:#F5F6FA;--c-surface:#FFFFFF;--c-card:#FFFFFF;--c-border:rgba(0,0,0,0.09);--c-border2:rgba(0,0,0,0.15);--c-text:#1A1B26;--c-muted:#6E6D7A;--c-sub:#888898;--c-purple-bg:rgba(159,143,247,0.15);--c-teal-bg:rgba(61,214,140,0.12);--c-amber-bg:rgba(245,166,35,0.12);--c-red-bg:rgba(240,84,84,0.12);--c-blue-bg:rgba(96,165,250,0.15);}
html.light .card{box-shadow:0 1px 4px rgba(0,0,0,.07);}
html.light .ep-tbl tr.changed td{background:rgba(245,166,35,.08);}
html.light .theme-btn{box-shadow:0 2px 12px rgba(0,0,0,.12);}
</style>
</head>
<body>
<div class="shell">

<header class="page-header">
  <p class="header-eyebrow">라플위클리 누적 · 시뮬레이션 (별도 페이지, 실제 리포트에 미반영)</p>
  <h1 class="header-title">자연유입 가중치 시뮬레이션 — 유입율:절대값 5:5 → ${mixLabel}</h1>
  <p class="header-sub">LTV Score(7일차) 공식의 N자연유입 산출 방식만 바꿔봤을 때 등급·순위가 얼마나 달라지는지 확인 (80편 전체)</p>
</header>

<div class="warn-banner">
  <b>⚠ 시뮬레이션 전용 페이지입니다</b><br>
  실제 <b>calc_ltv.js</b>는 여전히 유입율:절대값 = 5:5(단순평균) 공식을 사용 중이며, 이 페이지의 결과는 <b>weekly_cumulative_scored.json에 반영되지 않았습니다</b>. 공식 자체를 바꿀지 결정하기 전 참고용 비교표입니다.
</div>

<div class="kpi-strip">
  <div class="kpi-card purple">
    <p class="kpi-label">등급이 바뀐 편</p>
    <p class="kpi-val purple">${gradeChangedCount}편</p>
    <span class="kpi-badge">전체 ${rows.length}편 중</span>
  </div>
  <div class="kpi-card teal">
    <p class="kpi-label">TOP10 겹침</p>
    <p class="kpi-val teal">${top10Overlap}/10</p>
    <span class="kpi-badge">기존 vs 시뮬</span>
  </div>
  <div class="kpi-card amber">
    <p class="kpi-label">평균 점수 변화(|Δ|)</p>
    <p class="kpi-val amber">${avgAbsDelta.toFixed(4)}</p>
    <span class="kpi-badge">편당 평균</span>
  </div>
  <div class="kpi-card red">
    <p class="kpi-label">최대 순위 이동폭</p>
    <p class="kpi-val red">${maxAbsRankDelta}위</p>
    <span class="kpi-badge">80편 중 순위 기준</span>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">순위 이동폭 TOP15</p>
    <p class="section-desc">▲ ${mixLabel}에서 순위 상승(절대유입 규모가 컸던 편) · ▼ 순위 하락(유입율은 높았지만 절대유입이 작았던 편)</p>
  </div>
  <div class="card">
    <div class="chart-box" style="height:360px"><canvas id="c_movers"></canvas></div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">전체 순위 변동표</p>
    <p class="section-desc">기존순위(5:5) 기준 정렬 · 등급이 바뀐 ${gradeChangedCount}편은 강조 표시</p>
  </div>
  <div class="filter-tabs">
    <button class="ftab on" onclick="filterRows('all',this)">전체 ${rows.length}편</button>
    <button class="ftab" onclick="filterRows('changed',this)">등급 변경만(${gradeChangedCount}편)</button>
    <button class="ftab" onclick="filterRows('moved',this)">순위 이동 ±3위 이상</button>
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-scroll">
      <table class="ep-tbl">
        <thead><tr>
          <th>기존순위</th><th>이동</th><th>시뮬순위</th><th>에피소드</th><th>시즌</th>
          <th class="r">기존점수</th><th class="r">시뮬점수</th><th class="r">Δ점수</th>
          <th>기존등급</th><th>시뮬등급</th><th class="r">유입율</th><th class="r">유입(절대)</th>
        </tr></thead>
        <tbody id="rankBody"></tbody>
      </table>
    </div>
  </div>
</div>

</div><!-- /shell -->

<button id="theme-btn" class="theme-btn" onclick="(function(){var h=document.documentElement;var isLight=h.classList.toggle('light');localStorage.setItem('lp-theme',isLight?'light':'dark');document.getElementById('theme-btn').textContent=isLight?'🌙':'☀';})()">☀</button>

<script>
const GRID='rgba(255,255,255,0.06)', TICK={font:{size:10},color:'#6E6D7A'};
const SEASON_COLOR={'위클리 시즌1':'#60A5FA','위클리 시즌2':'#9F8FF7','위클리 시즌3':'#F472B6','위클리 시즌4':'#F5A623','위클리 시즌5':'#34D399','위클리 시즌6':'#22D3EE'};
const SEASON_NAME={'위클리 시즌1':'S1','위클리 시즌2':'S2','위클리 시즌3':'S3','위클리 시즌4':'S4','위클리 시즌5':'S5','위클리 시즌6':'S6'};

const ROWS=[
  ${rowsJs}
];

Chart.defaults.color='#6E6D7A';
new Chart(document.getElementById('c_movers'),{type:'bar',
  data:{labels:[${moverLabels}],datasets:[{data:[${moverDeltas}],backgroundColor:[${moverColors}],borderRadius:4,barPercentage:.7}]},
  options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
    tooltip:{callbacks:{label:c=>(c.parsed.x>0?'▲ 상승 ':'▼ 하락 ')+Math.abs(c.parsed.x)+'위'}}},
    scales:{x:{grid:{color:GRID},ticks:TICK,title:{display:true,text:'순위 이동폭(양수=상승)',color:'#6E6D7A',font:{size:11}}},
            y:{grid:{display:false},ticks:{...TICK,font:{size:11}}}}}});

let curFilter='all';
function filterRows(f,btn){
  curFilter=f;
  btn.parentElement.querySelectorAll('.ftab').forEach(t=>t.classList.remove('on'));
  btn.classList.add('on');
  renderRows();
}
function renderRows(){
  let list=ROWS;
  if(curFilter==='changed') list=ROWS.filter(r=>r.gradeChanged);
  if(curFilter==='moved') list=ROWS.filter(r=>Math.abs(r.delta)>=3);
  const tbody=document.getElementById('rankBody'); tbody.innerHTML='';
  list.forEach(d=>{
    const gc=g=>g==='S'?'gs':g==='A'?'ga':g==='B+'?'gbp':g==='B'?'gb':'gc';
    const arrow=d.delta>0?'▲':d.delta<0?'▼':'—';
    const color=d.delta>0?'var(--c-teal)':d.delta<0?'var(--c-red)':'var(--c-muted)';
    const tr=document.createElement('tr');
    if(d.gradeChanged) tr.className='changed';
    tr.innerHTML=\`
      <td class="ep-num">\${d.rb}위</td>
      <td style="color:\${color};font-weight:700">\${arrow} \${Math.abs(d.delta)}</td>
      <td class="ep-num">\${d.rs}위</td>
      <td><span class="ep-name">\${d.title}</span> <span class="ep-num">\${d.num}</span></td>
      <td><span class="season-tag" style="background:\${SEASON_COLOR[d.season]}22;color:\${SEASON_COLOR[d.season]}">\${SEASON_NAME[d.season]}</span></td>
      <td class="tr">\${d.v2Base.toFixed(3)}</td>
      <td class="tr">\${d.v2Sim.toFixed(3)}</td>
      <td class="tr" style="color:\${d.deltaScore>0?'var(--c-teal)':d.deltaScore<0?'var(--c-red)':'var(--c-muted)'};font-weight:600">\${d.deltaScore>0?'+':''}\${d.deltaScore.toFixed(3)}</td>
      <td><span class="gpill \${gc(d.gradeBase)}">\${d.gradeBase}</span></td>
      <td><span class="gpill \${gc(d.gradeSim)}">\${d.gradeSim}</span></td>
      <td class="tr">\${d.natPct}%</td>
      <td class="tr">\${d.natAbs.toLocaleString()}</td>\`;
    tbody.appendChild(tr);
  });
}
renderRows();
</script>
</body>
</html>
`;

const outFile = `자연유입_가중치_시뮬레이션_${mixFileLabel}.html`;
fs.writeFileSync(path.join(DIR, outFile), html, 'utf8');
console.log(`저장 완료: ${outFile}`);
console.log(`등급변화 ${gradeChangedCount}편, TOP10 겹침 ${top10Overlap}/10, 평균|Δ| ${avgAbsDelta.toFixed(4)}`);
