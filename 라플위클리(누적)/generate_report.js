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
  pending = JSON.parse(fs.readFileSync(path.join(DIR, 'weekly_cumulative_pending.json'), 'utf8').replace(/^﻿/, ''));
} catch (e) { /* 없으면 무시 */ }

// VR 데이터가 있는지 여부 — 1일차·7일차 모두 시즌5에서 결측(0)이라 플래그 하나를 두 탭에서 공유.
results.forEach(r => { r.vr_missing = !(r.vr_7d && r.vr_7d > 0); });

// 카테고리 교차분석 — 회차 제목(title) 기준으로 category_mapping.json(수동 태깅)과 조인.
const categoryMap = JSON.parse(fs.readFileSync(path.join(DIR, 'category_mapping.json'), 'utf8'));
const CATEGORIES = categoryMap.categories;
const CATEGORY_COLOR = {
  '영화·인물': '#60A5FA',
  '장르·트로프': '#9F8FF7',
  '인생·감정': '#F472B6',
  '사회·문화': '#F5A623',
  '일상·취향': '#3DD68C',
  '관계·가족': '#22D3EE',
};
results.forEach(r => { r.category = categoryMap.mapping[r.title] || '미분류'; });

function esc(s) { return String(s).replace(/'/g, "\\'"); }

// 등급 컷은 절대 점수가 아니라 위클리 내부 4분위 상대평가(calc_ltv.js에서 산정) — 표시용으로 실제 컷 값만 역산.
function gradeMinOf(v2Field, gradeField, grade) {
  return Math.min(...results.filter(r => r[gradeField] === grade).map(r => r[v2Field]));
}
const gradeCut = { S: gradeMinOf('v2', 'grade', 'S'), A: gradeMinOf('v2', 'grade', 'A'), 'B+': gradeMinOf('v2', 'grade', 'B+'), B: gradeMinOf('v2', 'grade', 'B') };
const gradeCut1d = { S: gradeMinOf('v2_1d', 'grade_1d', 'S'), A: gradeMinOf('v2_1d', 'grade_1d', 'A'), 'B+': gradeMinOf('v2_1d', 'grade_1d', 'B+'), B: gradeMinOf('v2_1d', 'grade_1d', 'B') };

const chronological = [...results].sort((a, b) => {
  const sa = SEASONS.indexOf(a.season), sb = SEASONS.indexOf(b.season);
  if (sa !== sb) return sa - sb;
  return String(a.num).localeCompare(String(b.num), undefined, { numeric: true });
});

function computeBySeasonStats(v2Field, gradeField) {
  return SEASONS.map(s => {
    const arr = results.filter(r => r.season === s);
    const avg = arr.reduce((a, r) => a + r[v2Field], 0) / arr.length;
    const grades = { S: 0, A: 0, 'B+': 0, B: 0, C: 0 };
    arr.forEach(r => grades[r[gradeField]]++);
    const vrMissingCount = arr.filter(r => r.vr_missing).length;
    return { season: s, count: arr.length, avg: +avg.toFixed(3), grades, vrMissingCount };
  });
}
const bySeasonStats = computeBySeasonStats('v2', 'grade');
const bySeasonStats1d = computeBySeasonStats('v2_1d', 'grade_1d');

function computeSummary(v2Field, gradeField, statsArr) {
  const channelAvg = results.reduce((a, r) => a + r[v2Field], 0) / results.length;
  const gradeCounts = { S: 0, A: 0, 'B+': 0, B: 0, C: 0 };
  results.forEach(r => gradeCounts[r[gradeField]]++);
  const bestSeason = [...statsArr].sort((a, b) => b.avg - a.avg)[0];
  const worstSeason = [...statsArr].sort((a, b) => a.avg - b.avg)[0];
  return { channelAvg, gradeCounts, bestSeason, worstSeason };
}
const totalCount = results.length;
const sum7d = computeSummary('v2', 'grade', bySeasonStats);
const sum1d = computeSummary('v2_1d', 'grade_1d', bySeasonStats1d);
const { channelAvg, gradeCounts, bestSeason, worstSeason } = sum7d;
const { channelAvg: channelAvg1d, gradeCounts: gradeCounts1d, bestSeason: bestSeason1d, worstSeason: worstSeason1d } = sum1d;
const vrMissingTotal = results.filter(r => r.vr_missing).length;

// 장기 성장 지수(28일차 조회수 ÷ 7일차 조회수) — 28일차 전용 점수공식 대신, 시간이 지나도
// 계속 발견되는 콘텐츠만 가볍게 짚어주는 보조 배지.
const growthPendingCount = results.filter(r => r.growth28_pending).length;
const growthDone = results.filter(r => !r.growth28_pending);
const topGrowth = [...growthDone].sort((a, b) => b.growth_28d - a.growth_28d).slice(0, 5);
const avgGrowth28 = growthDone.reduce((s, r) => s + r.growth_28d, 0) / growthDone.length;
const minGrowth28 = Math.min(...growthDone.map(r => r.growth_28d));

// 카테고리별 교차분석 — 평균 LTV(7d/1d), 등급분포, 장기성장지수 평균, 시즌별 구성비.
function computeByCategoryStats(v2Field, gradeField) {
  return CATEGORIES.map(cat => {
    const arr = results.filter(r => r.category === cat);
    const avg = arr.reduce((a, r) => a + r[v2Field], 0) / arr.length;
    const grades = { S: 0, A: 0, 'B+': 0, B: 0, C: 0 };
    arr.forEach(r => grades[r[gradeField]]++);
    return { category: cat, count: arr.length, avg: +avg.toFixed(3), grades };
  });
}
const byCatStats7d = computeByCategoryStats('v2', 'grade');
const byCatStats1d = computeByCategoryStats('v2_1d', 'grade_1d');

const byCatGrowth = CATEGORIES.map(cat => {
  const arr = growthDone.filter(r => r.category === cat);
  const avg = arr.length ? arr.reduce((a, r) => a + r.growth_28d, 0) / arr.length : null;
  return { category: cat, count: arr.length, avg: avg === null ? null : +avg.toFixed(3) };
});

const topEpByCat7d = CATEGORIES.map(cat => {
  const arr = results.filter(r => r.category === cat);
  return { category: cat, top: [...arr].sort((a, b) => b.v2 - a.v2)[0] };
});

const bestCat7d = [...byCatStats7d].sort((a, b) => b.avg - a.avg)[0];
const worstCat7d = [...byCatStats7d].sort((a, b) => a.avg - b.avg)[0];
const bestCatGrowth = [...byCatGrowth].filter(c => c.avg !== null).sort((a, b) => b.avg - a.avg)[0];

const seasonCatMatrix = SEASONS.map(s => {
  const arr = results.filter(r => r.season === s);
  const counts = {};
  CATEGORIES.forEach(c => { counts[c] = arr.filter(r => r.category === c).length; });
  return { season: s, counts, total: arr.length };
});

const catLabels = CATEGORIES.map(c => `'${c}'`).join(',');
const catColors = CATEGORIES.map(c => `'${CATEGORY_COLOR[c]}'`).join(',');
const catAvg7dJs = byCatStats7d.map(c => c.avg).join(',');
const catAvg1dJs = byCatStats1d.map(c => c.avg).join(',');
const catGrowthJs = byCatGrowth.map(c => c.avg === null ? 'null' : c.avg).join(',');
function catGradeAgg(statsArr) {
  return {
    S: statsArr.map(c => c.grades.S).join(','),
    A: statsArr.map(c => c.grades.A).join(','),
    Bp: statsArr.map(c => c.grades['B+']).join(','),
    B: statsArr.map(c => c.grades.B).join(','),
    C: statsArr.map(c => c.grades.C).join(','),
  };
}
const catGrade7d = catGradeAgg(byCatStats7d);
const catGrade1d = catGradeAgg(byCatStats1d);
const seasonCatLabels = seasonCatMatrix.map(s => `'${s.season.replace('위클리 ', '')}'`).join(',');
const seasonCatDatasetsJs = CATEGORIES.map(cat => (
  `{label:'${cat}',data:[${seasonCatMatrix.map(s => (s.counts[cat] / s.total * 100).toFixed(1)).join(',')}],backgroundColor:'${CATEGORY_COLOR[cat]}CC'}`
)).join(',\n  ');
const categoryColorJs = CATEGORIES.map(c => `'${c}':'${CATEGORY_COLOR[c]}'`).join(',');

// 카테고리별 편성 목록 — 카테고리 → 시즌/회차 순 정렬(어떤 편이 어느 카테고리에 편성됐는지 표용).
const catListSorted = [...results].sort((a, b) => {
  const ca = CATEGORIES.indexOf(a.category), cb = CATEGORIES.indexOf(b.category);
  if (ca !== cb) return ca - cb;
  const sa = SEASONS.indexOf(a.season), sb = SEASONS.indexOf(b.season);
  if (sa !== sb) return sa - sb;
  return String(a.num).localeCompare(String(b.num), undefined, { numeric: true });
});
const catListArrJs = catListSorted.map(r => (
  `{category:'${esc(r.category)}',season:'${esc(r.season)}',num:'${esc(r.num)}',title:'${esc(r.title)}',pub:'${r.pub_date || ''}',v2:${r.v2},grade:'${r.grade}'}`
)).join(',\n  ');

function buildDataArr(sortedArr, suf, v2Field, gradeField) {
  return sortedArr.map(r => (
    `{season:'${esc(r.season)}',num:'${esc(r.num)}',title:'${esc(r.title)}',pub:'${r.pub_date || ''}',` +
    `v2:${r[v2Field]},grade:'${r[gradeField]}',natPct:${(r['nat_pct_' + suf] * 100).toFixed(1)},natAbs:${Math.round(r['nat_abs_' + suf])},` +
    `vr:${(r['vr_' + suf] * 100).toFixed(1)},vrMissing:${r.vr_missing},ctr:${(r['ctr_' + suf] * 100).toFixed(1)},` +
    `sub:${Math.round(r['sub_' + suf])},views:${Math.round(r['views_' + suf])},eng:${Math.round(r['eng_' + suf])}}`
  )).join(',\n  ');
}
function buildRankedArr(suf, v2Field, gradeField) {
  return [...results].sort((a, b) => b[v2Field] - a[v2Field]).map(r => (
    `{season:'${esc(r.season)}',num:'${esc(r.num)}',title:'${esc(r.title)}',pub:'${r.pub_date || ''}',` +
    `v2:${r[v2Field]},grade:'${r[gradeField]}',natPct:${(r['nat_pct_' + suf] * 100).toFixed(1)},natAbs:${Math.round(r['nat_abs_' + suf])},` +
    `vr:${(r['vr_' + suf] * 100).toFixed(1)},vrMissing:${r.vr_missing},ctr:${(r['ctr_' + suf] * 100).toFixed(1)},sub:${Math.round(r['sub_' + suf])},` +
    `growth28:${r.growth28_pending ? 'null' : r.growth_28d}}`
  )).join(',\n  ');
}
const dataArrJs = buildDataArr(chronological, '7d', 'v2', 'grade');
const rankedArrJs = buildRankedArr('7d', 'v2', 'grade');
const dataArrJs1d = buildDataArr(chronological, '1d', 'v2_1d', 'grade_1d');
const rankedArrJs1d = buildRankedArr('1d', 'v2_1d', 'grade_1d');

function seasonAgg(statsArr) {
  return {
    avgs: statsArr.map(s => s.avg).join(','),
    S: statsArr.map(s => s.grades.S).join(','),
    A: statsArr.map(s => s.grades.A).join(','),
    Bp: statsArr.map(s => s.grades['B+']).join(','),
    B: statsArr.map(s => s.grades.B).join(','),
    C: statsArr.map(s => s.grades.C).join(','),
  };
}
const seasonLabels = bySeasonStats.map(s => `'${s.season.replace('위클리 ', '')}'`).join(',');
const seasonColors = SEASONS.map(s => `'${SEASON_COLOR[s]}'`).join(',');
const agg7d = seasonAgg(bySeasonStats);
const agg1d = seasonAgg(bySeasonStats1d);

// 1일차 순위와 7일차 순위가 얼마나 다른지 — "초기반응이 실제 성과를 얼마나 잘 예측했나" 확인용
const byRank7d = [...results].sort((a, b) => b.v2 - a.v2);
const byRank1d = [...results].sort((a, b) => b.v2_1d - a.v2_1d);
const rank7dOf = new Map(byRank7d.map((r, i) => [r, i + 1]));
const rank1dOf = new Map(byRank1d.map((r, i) => [r, i + 1]));
// delta 양수: 1일차엔 순위가 낮았는데(숫자 큼) 7일차엔 좋아짐(숫자 작아짐) = 슬로우 스타터
// delta 음수: 1일차엔 순위가 높았는데(숫자 작음) 7일차엔 밀림(숫자 커짐) = 반짝 스타터
const rankCompare = results.map(r => ({ r, rank7d: rank7dOf.get(r), rank1d: rank1dOf.get(r), delta: rank1dOf.get(r) - rank7dOf.get(r) }));
const slowStarters = [...rankCompare].sort((a, b) => b.delta - a.delta).slice(0, 5);
const flashStarters = [...rankCompare].sort((a, b) => a.delta - b.delta).slice(0, 5);
const top10_7dKeys = new Set(byRank7d.slice(0, 10).map(r => r.season + r.num));
const top10Overlap = byRank1d.slice(0, 10).filter(r => top10_7dKeys.has(r.season + r.num)).length;

function moverRow(m) {
  const arrow = m.delta > 0 ? '▲' : '▼';
  const color = m.delta > 0 ? 'var(--c-teal)' : 'var(--c-red)';
  return `<li><b>${m.r.season.replace('위클리 ', '')} ${m.r.num} ${m.r.title}</b> — 1일차 ${m.rank1d}위 → 7일차 ${m.rank7d}위 <span style="color:${color};font-weight:700">${arrow} ${Math.abs(m.delta)}</span></li>`;
}

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
.nav-tabs{display:flex;gap:2px;background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:3px;margin-bottom:24px;width:fit-content}
.nav-tab{font-size:14px;font-weight:500;padding:7px 16px;border-radius:5px;border:none;background:transparent;color:var(--c-muted);cursor:pointer;transition:all .15s;white-space:nowrap}
.nav-tab.on{background:rgba(159,143,247,.15);color:var(--c-purple);font-weight:600}
.panel{display:none}.panel.show{display:block}
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
.gbp{background:var(--c-amber-bg);color:var(--c-amber)}
.gb{background:var(--c-blue-bg);color:var(--c-blue)}
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
.key-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:9px;font-size:13px;color:var(--c-sub);line-height:1.6}
.key-list b{color:var(--c-text)}
.theme-btn{position:fixed;bottom:20px;right:20px;z-index:9999;width:38px;height:38px;border-radius:50%;border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.4);transition:border-color .15s,background .15s,box-shadow .15s;color:var(--c-muted);}
.theme-btn:hover{border-color:var(--c-purple);color:var(--c-text);}
html.light{--c-bg:#F5F6FA;--c-surface:#FFFFFF;--c-card:#FFFFFF;--c-border:rgba(0,0,0,0.09);--c-border2:rgba(0,0,0,0.15);--c-text:#1A1B26;--c-muted:#6E6D7A;--c-sub:#888898;--c-purple-bg:rgba(159,143,247,0.15);--c-teal-bg:rgba(61,214,140,0.12);--c-amber-bg:rgba(245,166,35,0.12);--c-red-bg:rgba(240,84,84,0.12);--c-blue-bg:rgba(96,165,250,0.15);}
html.light .card{box-shadow:0 1px 4px rgba(0,0,0,.07);}
html.light .theme-btn{box-shadow:0 2px 12px rgba(0,0,0,.12);}
</style>
</head>
<body>
<div class="shell">

<header class="page-header">
  <p class="header-eyebrow">라플위클리 · 누적 시즌 분석 (별도 프로젝트)</p>
  <h1 class="header-title">라플위클리 누적 LTV Score</h1>
  <p class="header-sub">시즌1~6(진행중) 전편에 라플TV Score 공식을 7일차(공식 집계) · 1일차(초기반응) 두 기준으로 적용</p>
  <div class="header-meta">
    <span class="meta-chip">총 ${totalCount}편 · 시즌1~6</span>
    <span class="meta-chip">발행 ${chronological[0].pub_date} ~ ${chronological[chronological.length - 1].pub_date}</span>
    <span class="meta-chip">채널 평균 LTV(7일차) ${channelAvg.toFixed(2)}</span>
    ${pending.length ? `<span class="meta-chip">7D 집계대기 ${pending.length}편</span>` : ''}
  </div>
</header>

${vrMissingTotal > 0 ? `<div class="warn-banner">
  <b>⚠ 데이터 결측 안내</b><br>
  <b>${vrMissingTotal}편(전체의 ${(vrMissingTotal/totalCount*100).toFixed(1)}%)</b>은 원본 엑셀에 <b>조회율(VR)·참여도(좋아요+공유+댓글)·트래픽소스(알고리즘/검색 유입)</b> 3개 지표가 전부 0으로 비어 있습니다. 1일차 탭에서도 같은 편이 동일하게 결측입니다.
  이 3개 항목이 LTV Score 가중치의 최대 48.0%(조회율 25.0% + 참여도 15.0% + 알고리즘·검색 보너스 최대 8.0%)를 차지하기 때문에, 결측 편의 점수는 실제 성적보다 상당히 낮게 나왔을 가능성이 큽니다 — 실제로 시즌2·3·4·5는 이 지표들이 보완된 뒤 평균이 크게 뛰었습니다(시즌2 0.51→0.68).
  지표가 마저 채워지면 이 리포트는 재계산되어야 정확해집니다(표에 <span class="vr-flag">VR 결측</span> 표시로 구분).
</div>` : ''}
${pending.length ? `<div class="warn-banner">※ ${pending.map(p => `${p.season.replace('위클리 ','')} ${p.num} ${p.title}`).join(', ')}은(는) 발행 후 7일 데이터가 아직 안 쌓여 이번 집계에서 제외했습니다.</div>` : ''}

<div class="nav-tabs">
  <button class="nav-tab on" onclick="sw('7d',this)">7일차 기준</button>
  <button class="nav-tab" onclick="sw('1d',this)">1일차 기준</button>
  <button class="nav-tab" onclick="sw('cat',this)">카테고리 분석</button>
</div>

<div class="panel show" id="panel-7d">

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
    <span class="kpi-badge">평균 ${worstSeason.avg.toFixed(2)}${bySeasonStats.find(s=>s.season===worstSeason.season).vrMissingCount ? ` · VR결측 ${bySeasonStats.find(s=>s.season===worstSeason.season).vrMissingCount}편` : ''}</span>
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
    <p class="card-sub">스택 바 · S/A/B+/B/C</p>
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
    <button class="ftab on" onclick="filterSeason('7d','all',this)">전체 ${totalCount}편</button>
    <button class="ftab" onclick="filterSeason('7d','위클리 시즌1',this)">시즌1</button>
    <button class="ftab" onclick="filterSeason('7d','위클리 시즌2',this)">시즌2</button>
    <button class="ftab" onclick="filterSeason('7d','위클리 시즌3',this)">시즌3</button>
    <button class="ftab" onclick="filterSeason('7d','위클리 시즌4',this)">시즌4</button>
    <button class="ftab" onclick="filterSeason('7d','위클리 시즌5',this)">시즌5</button>
    <button class="ftab" onclick="filterSeason('7d','위클리 시즌6',this)">시즌6</button>
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-scroll">
      <table class="ep-tbl">
        <thead><tr>
          <th>#</th><th>에피소드</th><th>시즌</th><th>발행일</th>
          <th class="r">LTV Score</th><th>등급</th>
          <th class="r">자연유입율</th><th class="r">자연유입(회)</th><th class="r">조회율(VR)</th><th class="r">CTR</th><th class="r">구독자</th><th class="r">장기성장(28d/7d)</th>
        </tr></thead>
        <tbody id="rankBody_7d"></tbody>
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
      <span class="cmt">&nbsp;&nbsp;(자연유입 비중 ≥ 30.0%)</span>
    </div>
    <div class="formula-line">
      &nbsp;&nbsp;<span class="plus">+ 알고리즘/검색 보너스</span>
      <span class="cmt">&nbsp;&nbsp;추천동영상·탐색기능 / 검색 유입 비중 기반, 최대 +0.08</span>
    </div>
    <div class="formula-line">
      &nbsp;&nbsp;<span class="minus">− 복합 패널티 (조회율&lt;10.0% · 구독↓&lt;0 · CTR&lt;2.0% 각 −0.025)</span>
      <span class="cmt">&nbsp;&nbsp;최대 −0.05</span>
    </div>
    <p class="formula-note">
      라플TV Score(HOT&amp;NEW·딥다이브 포함 최신 리포트)와 동일한 위클리(w) 벤치마크를 그대로 적용: 자연유입비중 31.7%·자연유입 100,196회·조회율 18.4%·CTR 3.6%·참여도 2,500건·구독자 180명 (기대값의 2배가 만점 기준) &nbsp;|&nbsp;
      등급은 채널 전체 벤치마크가 아니라 <b>위클리 ${totalCount}편 내 백분위 상대평가</b>: S 상위 10.0%(≥${gradeCut.S.toFixed(3)}) · A 다음 25.0%(≥${gradeCut.A.toFixed(3)}) · B+ 다음 30.0%(≥${gradeCut['B+'].toFixed(3)}) · B 다음 25.0%(≥${gradeCut.B.toFixed(3)}) · C 하위 10.0%(&lt;${gradeCut.B.toFixed(3)})
    </p>
  </div>
</div>

</div><!-- /panel-7d -->

<div class="panel" id="panel-1d">

<div class="kpi-strip">
  <div class="kpi-card purple">
    <p class="kpi-label">전체 평균 LTV(1일차)</p>
    <p class="kpi-val purple">${channelAvg1d.toFixed(2)}</p>
    <span class="kpi-badge">시즌1~6, ${totalCount}편</span>
  </div>
  <div class="kpi-card teal">
    <p class="kpi-label">S / A 등급(1일차)</p>
    <p class="kpi-val teal">${gradeCounts1d.S + gradeCounts1d.A}편</p>
    <span class="kpi-badge">S ${gradeCounts1d.S} · A ${gradeCounts1d.A}</span>
  </div>
  <div class="kpi-card amber">
    <p class="kpi-label">7일차 TOP10과 겹침</p>
    <p class="kpi-val amber">${top10Overlap}/10</p>
    <span class="kpi-badge">1일차만 봤을 때 예측 정확도</span>
  </div>
  <div class="kpi-card red">
    <p class="kpi-label">최저 평균 시즌(1일차)</p>
    <p class="kpi-val red">${worstSeason1d.season.replace('위클리 ', '')}</p>
    <span class="kpi-badge">평균 ${worstSeason1d.avg.toFixed(2)}</span>
  </div>
</div>

<div class="section">
  <div class="card">
    <p class="card-title">1일차 성적이 7일차와 얼마나 달랐나</p>
    <p class="card-sub">전체 ${totalCount}편 중 1일차 TOP10과 7일차 TOP10이 겹치는 편수: <b style="color:var(--c-text)">${top10Overlap}/10</b> — 초반 반응만으로는 최종 순위를 절반도 못 맞춘다는 뜻입니다.</p>
  </div>
</div>

<div class="grid-2 section">
  <div class="card">
    <p class="card-title">초반엔 저평가, 나중에 뜬 편 (슬로우 스타터)</p>
    <p class="card-sub">1일차 순위 → 7일차 순위 상승폭이 가장 큰 5편</p>
    <ul class="key-list">
      ${slowStarters.map(moverRow).join('\n      ')}
    </ul>
  </div>
  <div class="card">
    <p class="card-title">초반엔 반짝, 오래 못 간 편 (플래시 스타터)</p>
    <p class="card-sub">1일차 순위 → 7일차 순위 하락폭이 가장 큰 5편</p>
    <ul class="key-list">
      ${flashStarters.map(moverRow).join('\n      ')}
    </ul>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">시즌별 평균 LTV 추이(1일차)</p>
    <p class="section-desc">시즌1→6, 막대 위 숫자 = 해당 시즌 평균 LTV Score(1일차)</p>
  </div>
  <div class="card">
    <div class="chart-box" style="height:240px"><canvas id="c_season_avg_1d"></canvas></div>
  </div>
</div>

<div class="grid-2 section">
  <div class="card">
    <p class="card-title">시즌별 등급 분포(1일차)</p>
    <p class="card-sub">스택 바 · S/A/B+/B/C</p>
    <div class="chart-box" style="height:220px"><canvas id="c_season_grade_1d"></canvas></div>
  </div>
  <div class="card">
    <p class="card-title">전체 ${totalCount}편 LTV Score 분포(1일차)</p>
    <p class="card-sub">발행 순 · 색상 = 시즌</p>
    <div class="chart-box" style="height:220px"><canvas id="c_all_dist_1d"></canvas></div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">전체 순위표(1일차)</p>
    <p class="section-desc">LTV Score(1일차) 내림차순 · VR 결측 구간은 참고용으로 표시</p>
  </div>
  <div class="filter-tabs">
    <button class="ftab on" onclick="filterSeason('1d','all',this)">전체 ${totalCount}편</button>
    <button class="ftab" onclick="filterSeason('1d','위클리 시즌1',this)">시즌1</button>
    <button class="ftab" onclick="filterSeason('1d','위클리 시즌2',this)">시즌2</button>
    <button class="ftab" onclick="filterSeason('1d','위클리 시즌3',this)">시즌3</button>
    <button class="ftab" onclick="filterSeason('1d','위클리 시즌4',this)">시즌4</button>
    <button class="ftab" onclick="filterSeason('1d','위클리 시즌5',this)">시즌5</button>
    <button class="ftab" onclick="filterSeason('1d','위클리 시즌6',this)">시즌6</button>
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-scroll">
      <table class="ep-tbl">
        <thead><tr>
          <th>#</th><th>에피소드</th><th>시즌</th><th>발행일</th>
          <th class="r">LTV Score(1일차)</th><th>등급</th>
          <th class="r">자연유입율</th><th class="r">자연유입(회)</th><th class="r">조회율(VR)</th><th class="r">CTR</th><th class="r">구독자</th><th class="r">장기성장(28d/7d)</th>
        </tr></thead>
        <tbody id="rankBody_1d"></tbody>
      </table>
    </div>
  </div>
</div>

<div class="section">
  <div class="formula-box">
    <div class="formula-line">
      <span class="v">LTV Score(1일차)</span> = <span class="v">N</span><sub>자연유입</sub>×<span class="w">0.229</span>
       + <span class="v">N</span><sub>조회율</sub>×<span class="w">0.191</span>
       + <span class="v">N</span><sub>CTR</sub>×<span class="w">0.153</span>
       + <span class="v">N</span><sub>참여도</sub>×<span class="w">0.115</span>
       + <span class="v">N</span><sub>구독자</sub>×<span class="w">0.076</span>
       + <span class="v">N</span><sub>시청시간</sub>×<span class="w">0.236</span>
    </div>
    <div class="formula-line">
      &nbsp;&nbsp;<span class="plus">+ 롱테일 보너스 +0.05</span>
      <span class="cmt">&nbsp;&nbsp;(자연유입 비중 ≥ 54.1%, 1일차 위클리 자체 평균)</span>
    </div>
    <div class="formula-line">
      &nbsp;&nbsp;<span class="minus">− 복합 패널티 (조회율&lt;14.6% · 구독↓&lt;0 · CTR&lt;2.3% 각 −0.025)</span>
      <span class="cmt">&nbsp;&nbsp;최대 −0.05</span>
    </div>
    <p class="formula-note">
      <b>평균시청시간을 6번째 항목으로 추가했습니다</b> — 위클리 66편에서 "1일차 지표가 최종(7일차) 점수를 얼마나 잘 예측하는지" 확인해보니 참여도(r=0.79)에 이어 평균시청시간(r=0.61, 기존 공식엔 없던 지표)이 자연유입·조회율보다도 예측력이 높았습니다. 반면 CTR은 1일차엔 대부분 구독자 피드 노출이라 편차가 거의 없어(r=0.09) 원래 비중만큼의 변별력을 보여주지 못했지만, 이번엔 시청시간의 몫(예측력 비례 23.6%)만 새로 반영하고 나머지 5개 항목은 <b>7일차와 동일한 상대비율(30:25:20:15:10)을 유지</b>한 채 축소했습니다 — CTR·참여도 비중 자체를 조정하는 건 별도 논의 사항입니다. &nbsp;|&nbsp;
      <b>알고리즘/검색 보너스는 1일차에 적용하지 않습니다</b> — 원본 엑셀의 트래픽소스(추천·검색 유입) 데이터가 7일차 기준으로만 존재해서 1일차 원본값 자체가 없습니다. &nbsp;|&nbsp;
      7일차 벤치마크(채널 전체 검증 기준)를 그대로 쓰면 1일차엔 자연유입비중·조회율·CTR이 구조적으로 훨씬 높게 나와(예: 자연유입비중 1일차 평균 54.1% vs 7일차 벤치마크 31.7%) 거의 전 편이 만점 처리되므로, <b>위클리 자체 66편(VR·참여도 결측 없는 시즌1,2,3,4,6)의 1일차 평균으로 벤치마크를 별도 도출</b>했습니다: 자연유입비중 54.1%·자연유입 44,929회·조회율 29.3%·CTR 4.5%·참여도 1,477건·구독자 165명·평균시청시간 14.71분. &nbsp;|&nbsp;
      등급도 이 리포트 내 1일차 점수의 <b>백분위 상대평가</b>: S 상위 10.0%(≥${gradeCut1d.S.toFixed(3)}) · A 다음 25.0%(≥${gradeCut1d.A.toFixed(3)}) · B+ 다음 30.0%(≥${gradeCut1d['B+'].toFixed(3)}) · B 다음 25.0%(≥${gradeCut1d.B.toFixed(3)}) · C 하위 10.0%(&lt;${gradeCut1d.B.toFixed(3)})
    </p>
  </div>
</div>

</div><!-- /panel-1d -->

<div class="panel" id="panel-cat">

<div class="kpi-strip">
  <div class="kpi-card purple">
    <p class="kpi-label">카테고리 구성</p>
    <p class="kpi-val purple">${CATEGORIES.length}개</p>
    <span class="kpi-badge">전체 ${totalCount}편 태깅</span>
  </div>
  <div class="kpi-card teal">
    <p class="kpi-label">최고 평균 카테고리(7일차)</p>
    <p class="kpi-val teal">${bestCat7d.category}</p>
    <span class="kpi-badge">평균 ${bestCat7d.avg.toFixed(2)} · ${bestCat7d.count}편</span>
  </div>
  <div class="kpi-card red">
    <p class="kpi-label">최저 평균 카테고리(7일차)</p>
    <p class="kpi-val red">${worstCat7d.category}</p>
    <span class="kpi-badge">평균 ${worstCat7d.avg.toFixed(2)} · ${worstCat7d.count}편</span>
  </div>
  <div class="kpi-card amber">
    <p class="kpi-label">가장 롱테일한 카테고리</p>
    <p class="kpi-val amber">${bestCatGrowth.category}</p>
    <span class="kpi-badge">장기성장지수 평균 ×${bestCatGrowth.avg.toFixed(2)}</span>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">카테고리별 평균 LTV Score</p>
    <p class="section-desc">7일차·1일차 비교 · 회차 제목을 category_mapping.json 6개 카테고리로 수동 태깅해 조인</p>
  </div>
  <div class="card">
    <div class="chart-box" style="height:260px"><canvas id="c_cat_avg"></canvas></div>
  </div>
</div>

<div class="grid-2 section">
  <div class="card">
    <p class="card-title">카테고리별 등급 분포(7일차)</p>
    <p class="card-sub">스택 바 · S/A/B+/B/C</p>
    <div class="chart-box" style="height:220px"><canvas id="c_cat_grade_7d"></canvas></div>
  </div>
  <div class="card">
    <p class="card-title">카테고리별 등급 분포(1일차)</p>
    <p class="card-sub">스택 바 · S/A/B+/B/C</p>
    <div class="chart-box" style="height:220px"><canvas id="c_cat_grade_1d"></canvas></div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">카테고리별 장기성장지수(28d/7d) 평균</p>
    <p class="section-desc">집계대기 편 제외 · 배수가 높을수록 발행 초반 이후에도 꾸준히 새로 발견되는 카테고리</p>
  </div>
  <div class="card">
    <div class="chart-box" style="height:220px"><canvas id="c_cat_growth"></canvas></div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">시즌별 카테고리 구성 변화</p>
    <p class="section-desc">100% 스택 바 · 시즌이 지나면서 어떤 카테고리 비중이 늘고 줄었는지</p>
  </div>
  <div class="card">
    <div class="chart-box" style="height:260px"><canvas id="c_season_cat"></canvas></div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">카테고리별 요약</p>
    <p class="section-desc">편수 · 평균 LTV(7일차/1일차) · 평균 장기성장지수 · 해당 카테고리 최고 성과 회차(7일차 기준)</p>
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-scroll">
      <table class="bench-tbl">
        <thead><tr>
          <th class="l">카테고리</th><th>편수</th><th>평균 LTV(7일차)</th><th>평균 LTV(1일차)</th><th>평균 장기성장지수</th><th class="l">최고 성과 회차(7일차)</th>
        </tr></thead>
        <tbody>
          ${byCatStats7d.map((c, i) => {
            const c1d = byCatStats1d[i];
            const g = byCatGrowth[i];
            const top = topEpByCat7d[i].top;
            return `<tr>
              <td class="l"><span class="season-tag" style="background:${CATEGORY_COLOR[c.category]}22;color:${CATEGORY_COLOR[c.category]}">${c.category}</span></td>
              <td>${c.count}편</td>
              <td>${c.avg.toFixed(3)}</td>
              <td>${c1d.avg.toFixed(3)}</td>
              <td>${g.avg === null ? '-' : '×' + g.avg.toFixed(2)}</td>
              <td class="l">${top.season.replace('위클리 ', '')} ${top.num} ${top.title} <span class="ep-num">(${top.v2.toFixed(3)})</span></td>
            </tr>`;
          }).join('\n          ')}
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <p class="section-title">카테고리별 편성 목록</p>
    <p class="section-desc">각 카테고리에 어떤 회차가 편성됐는지 · 카테고리 → 발행 순 정렬</p>
  </div>
  <div class="filter-tabs">
    <button class="ftab on" onclick="filterCategory('all',this)">전체 ${totalCount}편</button>
    ${CATEGORIES.map(c => `<button class="ftab" onclick="filterCategory('${c}',this)">${c}</button>`).join('\n    ')}
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-scroll">
      <table class="ep-tbl">
        <thead><tr>
          <th>#</th><th>카테고리</th><th>에피소드</th><th>시즌</th><th>발행일</th>
          <th class="r">LTV(7일차)</th><th>등급</th>
        </tr></thead>
        <tbody id="catListBody"></tbody>
      </table>
    </div>
  </div>
</div>

</div><!-- /panel-cat -->

<div class="section" id="growthGlobalSection">
  <div class="card">
    <p class="card-title">장기 성장 지수 — 시간이 지나도 계속 발견되는 콘텐츠</p>
    <p class="card-sub">발행 후 28일 누적 조회수 ÷ 발행 후 7일 누적 조회수 · LTV Score와는 완전히 별개인 보조 지표라 7일차/1일차 탭 공통으로 동일하게 표시됩니다</p>
    <p style="font-size:13px;color:var(--c-sub);line-height:1.85;margin-bottom:14px">
      <b style="color:var(--c-text)">무엇을 보는 지표인가</b> — 같은 편의 조회수를 발행 후 7일 시점과 28일 시점, 두 번의 스냅샷으로 나눈 값입니다. 28일차 누적치는 7일차 누적치를 항상 포함하므로 이 지수는 정의상 <b style="color:var(--c-text)">항상 1.0배 이상</b>입니다. <b style="color:var(--c-text)">1.0배에 가까울수록</b> "발행 초반 버즈가 소진된 뒤로는 거의 추가로 안 봤다"는 뜻이고, <b style="color:var(--c-text)">배수가 높을수록</b> 발행 시점이 한참 지난 뒤에도 유튜브 알고리즘 추천·검색을 통해 꾸준히 새로 발견되고 있다는 뜻입니다 — 이른바 "롱테일"·"에버그린" 콘텐츠 신호입니다.<br><br>
      <b style="color:var(--c-text)">산출 방법</b> — 원본 엑셀의 views_7d·views_28d 컬럼(발행일 기준 경과일 스냅샷이라 편마다 실제 캘린더 날짜는 다름)을 <span class="cmt" style="font-family:'SF Mono','Fira Code',monospace">views_28d ÷ views_7d</span>로 그대로 나눈 원배율입니다. LTV Score처럼 벤치마크 대비 정규화(N)하거나 가중치를 곱하는 과정이 없고, "얼마나 더 늘었나"를 있는 그대로 보여주는 게 목적이라 별도 등급·백분위 구간도 적용하지 않았습니다.<br><br>
      <b style="color:var(--c-text)">집계대기 처리</b> — 발행일로부터 28일이 아직 지나지 않은 편은 views_28d가 0(또는 결측)으로 들어와 있어 계산 자체가 불가능합니다. 이런 편은 "집계대기"로 별도 표시하고 아래 평균·순위 계산에서는 제외합니다(현재 ${growthPendingCount}편).<br><br>
      <b style="color:var(--c-text)">LTV Score 공식에는 반영하지 않는 이유</b> — 최근 발행 편일수록 아직 28일이 안 지나 결측일 확률이 높은 지표라, 정식 점수 공식에 그대로 넣으면 신작이 구조적으로 불리해집니다. 그래서 점수·등급과는 완전히 분리해 참고용 배지로만 별도 운영합니다.<br><br>
      <b style="color:var(--c-text)">현재 분포</b> — 집계 완료 ${growthDone.length}편(전체 ${totalCount}편 중 집계대기 ${growthPendingCount}편 제외) 기준 평균 <b style="color:var(--c-text)">×${avgGrowth28.toFixed(2)}</b>, 최저 ×${minGrowth28.toFixed(2)}(거의 추가 성장 없음)부터 최고 ×${topGrowth[0].growth_28d.toFixed(2)}(TOP1, 아래 목록 참고)까지 분포합니다.
    </p>
    <ul class="key-list">
      ${topGrowth.map(r => `<li><b>${r.season.replace('위클리 ', '')} ${r.num} ${r.title}</b> — 7일차 대비 28일차 조회수 <span style="color:var(--c-teal);font-weight:700">×${r.growth_28d.toFixed(2)}</span></li>`).join('\n      ')}
    </ul>
  </div>
</div>

</div><!-- /shell -->

<button id="theme-btn" class="theme-btn" onclick="(function(){var h=document.documentElement;var isLight=h.classList.toggle('light');localStorage.setItem('lp-theme',isLight?'light':'dark');document.getElementById('theme-btn').textContent=isLight?'🌙':'☀';})()">☀</button>

<script>
const GRID='rgba(255,255,255,0.06)', TICK={font:{size:10},color:'#6E6D7A'};
const BC={S:'#9F8FF7',A:'#3DD68C','B+':'#F5A623',B:'#60A5FA',C:'#6E6D7A'};
const SEASON_COLOR={'위클리 시즌1':'#60A5FA','위클리 시즌2':'#9F8FF7','위클리 시즌3':'#F472B6','위클리 시즌4':'#F5A623','위클리 시즌5':'#34D399','위클리 시즌6':'#22D3EE'};
const SEASON_NAME={'위클리 시즌1':'S1','위클리 시즌2':'S2','위클리 시즌3':'S3','위클리 시즌4':'S4','위클리 시즌5':'S5','위클리 시즌6':'S6'};

const DATA={ '7d':[
  ${dataArrJs}
], '1d':[
  ${dataArrJs1d}
] };
const RANKED={ '7d':[
  ${rankedArrJs}
], '1d':[
  ${rankedArrJs1d}
] };
const CATEGORY_COLOR={${categoryColorJs}};
const CATLIST=[
  ${catListArrJs}
];

Chart.defaults.color='#6E6D7A';
const charts={};

function sw(id,btn){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
  document.getElementById('panel-'+id).classList.add('show');
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('growthGlobalSection').style.display = id==='cat' ? 'none' : '';
  Object.values(charts).forEach(c=>{ if(c) c.resize(); });
}

function seasonAvgChart(id, labels, data, colors){
  return new Chart(document.getElementById(id),{type:'bar',
    data:{labels,datasets:[{data,backgroundColor:colors,borderRadius:6,barPercentage:.55}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>'평균 LTV '+c.parsed.y.toFixed(3)}}},
      scales:{x:{grid:{display:false},ticks:TICK},
              y:{grid:{color:GRID},ticks:{...TICK,callback:v=>v.toFixed(1)},min:0,max:.8}}}});
}
function seasonGradeChart(id, labels, S,A,Bp,B,C){
  return new Chart(document.getElementById(id),{type:'bar',
    data:{labels,datasets:[
      {label:'S',data:S,backgroundColor:'rgba(159,143,247,.8)',stack:'g',borderRadius:3},
      {label:'A',data:A,backgroundColor:'rgba(61,214,140,.8)',stack:'g',borderRadius:3},
      {label:'B+',data:Bp,backgroundColor:'rgba(245,166,35,.7)',stack:'g',borderRadius:3},
      {label:'B',data:B,backgroundColor:'rgba(96,165,250,.7)',stack:'g',borderRadius:3},
      {label:'C',data:C,backgroundColor:'rgba(110,109,122,.4)',stack:'g',borderRadius:3},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{font:{size:10},boxWidth:10,color:'#9997A8'}}},
      scales:{x:{stacked:true,grid:{display:false},ticks:TICK},y:{stacked:true,grid:{color:GRID},ticks:TICK}}}});
}
function allDistChart(id, tab){
  const d = DATA[tab];
  return new Chart(document.getElementById(id),{type:'bar',
    data:{labels:d.map(x=>SEASON_NAME[x.season]+' '+x.num),
      datasets:[{data:d.map(x=>x.v2),
        backgroundColor:d.map(x=>SEASON_COLOR[x.season]+'BB'),
        borderColor:d.map(x=>SEASON_COLOR[x.season]),borderWidth:.5,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{title:c=>d[c[0].dataIndex].title,label:c=>'LTV '+c.parsed.y.toFixed(3)+(d[c[0].dataIndex].vrMissing?' (VR 결측)':'')}}},
      scales:{x:{grid:{display:false},ticks:{...TICK,maxRotation:60,font:{size:8},autoSkip:true,maxTicksLimit:20}},
              y:{grid:{color:GRID},ticks:{...TICK,callback:v=>v.toFixed(1)},min:0,max:1}}}});
}

charts.seasonAvg7d = seasonAvgChart('c_season_avg', [${seasonLabels}], [${agg7d.avgs}], [${seasonColors}]);
charts.seasonGrade7d = seasonGradeChart('c_season_grade', [${seasonLabels}], [${agg7d.S}],[${agg7d.A}],[${agg7d.Bp}],[${agg7d.B}],[${agg7d.C}]);
charts.allDist7d = allDistChart('c_all_dist', '7d');

charts.seasonAvg1d = seasonAvgChart('c_season_avg_1d', [${seasonLabels}], [${agg1d.avgs}], [${seasonColors}]);
charts.seasonGrade1d = seasonGradeChart('c_season_grade_1d', [${seasonLabels}], [${agg1d.S}],[${agg1d.A}],[${agg1d.Bp}],[${agg1d.B}],[${agg1d.C}]);
charts.allDist1d = allDistChart('c_all_dist_1d', '1d');

function catAvgChart(id, labels, avg7d, avg1d, colors){
  return new Chart(document.getElementById(id),{type:'bar',
    data:{labels,datasets:[
      {label:'7일차',data:avg7d,backgroundColor:colors.map(c=>c+'CC'),borderRadius:6},
      {label:'1일차',data:avg1d,backgroundColor:colors.map(c=>c+'55'),borderRadius:6},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{font:{size:10},boxWidth:10,color:'#9997A8'}},
        tooltip:{callbacks:{label:c=>c.dataset.label+' 평균 LTV '+c.parsed.y.toFixed(3)}}},
      scales:{x:{grid:{display:false},ticks:{...TICK,font:{size:10}}},
              y:{grid:{color:GRID},ticks:{...TICK,callback:v=>v.toFixed(1)},min:0}}}});
}
function catGradeChart(id, labels, S,A,Bp,B,C){
  return new Chart(document.getElementById(id),{type:'bar',
    data:{labels,datasets:[
      {label:'S',data:S,backgroundColor:'rgba(159,143,247,.8)',stack:'g',borderRadius:3},
      {label:'A',data:A,backgroundColor:'rgba(61,214,140,.8)',stack:'g',borderRadius:3},
      {label:'B+',data:Bp,backgroundColor:'rgba(245,166,35,.7)',stack:'g',borderRadius:3},
      {label:'B',data:B,backgroundColor:'rgba(96,165,250,.7)',stack:'g',borderRadius:3},
      {label:'C',data:C,backgroundColor:'rgba(110,109,122,.4)',stack:'g',borderRadius:3},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{font:{size:10},boxWidth:10,color:'#9997A8'}}},
      scales:{x:{stacked:true,grid:{display:false},ticks:{...TICK,font:{size:9}}},y:{stacked:true,grid:{color:GRID},ticks:TICK}}}});
}
function catGrowthChart(id, labels, data, colors){
  return new Chart(document.getElementById(id),{type:'bar',
    data:{labels,datasets:[{data,backgroundColor:colors.map(c=>c+'BB'),borderRadius:6,barPercentage:.55}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>c.parsed.y==null?'집계대기':'평균 ×'+c.parsed.y.toFixed(2)}}},
      scales:{x:{grid:{display:false},ticks:{...TICK,font:{size:10}}},
              y:{grid:{color:GRID},ticks:{...TICK,callback:v=>'×'+v.toFixed(1)},min:1}}}});
}
function seasonCatChart(id, labels, datasets){
  return new Chart(document.getElementById(id),{type:'bar',
    data:{labels,datasets},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{font:{size:10},boxWidth:10,color:'#9997A8'}},
        tooltip:{callbacks:{label:c=>c.dataset.label+' '+c.parsed.y.toFixed(1)+'%'}}},
      scales:{x:{stacked:true,grid:{display:false},ticks:TICK},
              y:{stacked:true,grid:{color:GRID},ticks:{...TICK,callback:v=>v+'%'},min:0,max:100}}}});
}

charts.catAvg = catAvgChart('c_cat_avg', [${catLabels}], [${catAvg7dJs}], [${catAvg1dJs}], [${catColors}]);
charts.catGrade7d = catGradeChart('c_cat_grade_7d', [${catLabels}], [${catGrade7d.S}],[${catGrade7d.A}],[${catGrade7d.Bp}],[${catGrade7d.B}],[${catGrade7d.C}]);
charts.catGrade1d = catGradeChart('c_cat_grade_1d', [${catLabels}], [${catGrade1d.S}],[${catGrade1d.A}],[${catGrade1d.Bp}],[${catGrade1d.B}],[${catGrade1d.C}]);
charts.catGrowth = catGrowthChart('c_cat_growth', [${catLabels}], [${catGrowthJs}], [${catColors}]);
charts.seasonCat = seasonCatChart('c_season_cat', [${seasonCatLabels}], [
  ${seasonCatDatasetsJs}
]);

/* 순위 테이블 */
const curSeason = { '7d':'all', '1d':'all' };
function filterSeason(tab,s,btn){
  curSeason[tab]=s;
  btn.parentElement.querySelectorAll('.ftab').forEach(t=>t.classList.remove('on'));
  btn.classList.add('on');
  renderRank(tab);
}
function renderRank(tab){
  const list=curSeason[tab]==='all'?RANKED[tab]:RANKED[tab].filter(d=>d.season===curSeason[tab]);
  const tbody=document.getElementById('rankBody_'+tab); tbody.innerHTML='';
  list.forEach((d,i)=>{
    const gc=d.grade==='S'?'gs':d.grade==='A'?'ga':d.grade==='B+'?'gbp':d.grade==='B'?'gb':'gc';
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
      <td class="tr">\${d.sub>0?'+':''}\${d.sub.toLocaleString()}</td>
      <td class="tr">\${d.growth28==null?'<span class="vr-flag">집계대기</span>':'×'+d.growth28.toFixed(2)}</td>\`;
    tbody.appendChild(tr);
  });
}
renderRank('7d');
renderRank('1d');

/* 카테고리별 편성 목록 */
let curCatFilter = 'all';
function filterCategory(c,btn){
  curCatFilter=c;
  btn.parentElement.querySelectorAll('.ftab').forEach(t=>t.classList.remove('on'));
  btn.classList.add('on');
  renderCatList();
}
function renderCatList(){
  const list = curCatFilter==='all' ? CATLIST : CATLIST.filter(d=>d.category===curCatFilter);
  const tbody=document.getElementById('catListBody'); tbody.innerHTML='';
  list.forEach((d,i)=>{
    const gc=d.grade==='S'?'gs':d.grade==='A'?'ga':d.grade==='B+'?'gbp':d.grade==='B'?'gb':'gc';
    const tr=document.createElement('tr');
    tr.innerHTML=\`
      <td><span class="ep-num">\${i+1}</span></td>
      <td><span class="season-tag" style="background:\${CATEGORY_COLOR[d.category]}22;color:\${CATEGORY_COLOR[d.category]}">\${d.category}</span></td>
      <td><span class="ep-name">\${d.title}</span> <span class="ep-num">\${d.num}</span></td>
      <td><span class="season-tag" style="background:\${SEASON_COLOR[d.season]}22;color:\${SEASON_COLOR[d.season]}">\${SEASON_NAME[d.season]}</span></td>
      <td class="ep-num">\${d.pub}</td>
      <td class="tr" style="font-weight:600;color:\${BC[d.grade]}">\${d.v2.toFixed(3)}</td>
      <td><span class="gpill \${gc}">\${d.grade}</span></td>\`;
    tbody.appendChild(tr);
  });
}
renderCatList();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(DIR, '라플위클리_누적_시즌분석.html'), html, 'utf8');
console.log('저장 완료: 라플위클리_누적_시즌분석.html');
