const fs = require('fs');

const raw = JSON.parse(fs.readFileSync(__dirname + '/weekly_cumulative_data.json', 'utf8').replace(/^﻿/, ''));

// 위클리(w) 벤치마크 — generate-tv-score 스킬의 실제 구현 기준(0706 검증본)과 동일
const BENCH_W = { nat_pct: 0.317, nat_abs: 100196, vr: 0.184, ctr: 0.0364, eng: 2500, sub: 180 };

function N(v, bench) {
  if (v == null || isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v / (bench * 2)));
}

function calcLTV(ep) {
  const b = BENCH_W;
  const nNatPct = N(ep.nat_pct_7d, b.nat_pct);
  const nNatAbs = N(ep.nat_abs_7d, b.nat_abs);
  const nNat = (nNatPct + nNatAbs) / 2;
  const nVr = N(ep.vr_7d, b.vr);
  const nCtr = N(ep.ctr_7d, b.ctr);
  const nEng = N(ep.eng_7d, b.eng);
  const nSub = N(ep.sub_7d, b.sub);

  const base = nNat * 0.30 + nVr * 0.25 + nCtr * 0.20 + nEng * 0.15 + nSub * 0.10;

  const b_org = ep.nat_pct_7d >= 0.30 ? 0.05 : 0;
  const b_algo = Math.min(0.05, (ep.algo_pct_7d || 0) * 0.5);
  const b_srch = Math.min(0.03, (ep.srch_pct_7d || 0) * 0.6);

  let pen = 0;
  if (ep.vr_7d != null && ep.vr_7d < 0.10) pen += 0.025;
  if (ep.sub_7d != null && ep.sub_7d < 0) pen += 0.025;
  if (ep.ctr_7d != null && ep.ctr_7d < 0.02) pen += 0.025;
  pen = Math.min(0.05, pen);

  const v2 = base + b_org + b_algo + b_srch - pen;
  return {
    v2: +v2.toFixed(3),
    nNat: +nNat.toFixed(3), nVr: +nVr.toFixed(3), nCtr: +nCtr.toFixed(3), nEng: +nEng.toFixed(3), nSub: +nSub.toFixed(3),
    b_org: +b_org.toFixed(3), b_algo: +b_algo.toFixed(3), b_srch: +b_srch.toFixed(3), pen: +pen.toFixed(3),
  };
}

function grade(v2) {
  if (v2 >= 0.70) return 'S';
  if (v2 >= 0.50) return 'A';
  if (v2 >= 0.35) return 'B';
  return 'C';
}

const results = raw.map(ep => {
  const c = calcLTV(ep);
  return { ...ep, ...c, grade: grade(c.v2) };
});

results.sort((a, b) => b.v2 - a.v2);

// 검증 출력
const counts = { S: 0, A: 0, B: 0, C: 0 };
results.forEach(r => counts[r.grade]++);
console.log('총편수:', results.length, '등급분포:', counts);
console.log('채널평균 LTV:', (results.reduce((s, r) => s + r.v2, 0) / results.length).toFixed(4));

const bySeason = {};
results.forEach(r => {
  if (!bySeason[r.season]) bySeason[r.season] = [];
  bySeason[r.season].push(r);
});
Object.keys(bySeason).sort().forEach(s => {
  const arr = bySeason[s];
  const avg = arr.reduce((sum, r) => sum + r.v2, 0) / arr.length;
  const g = { S: 0, A: 0, B: 0, C: 0 };
  arr.forEach(r => g[r.grade]++);
  console.log(`${s}: ${arr.length}편, 평균 ${avg.toFixed(3)}, S${g.S} A${g.A} B${g.B} C${g.C}`);
});

fs.writeFileSync(__dirname + '/weekly_cumulative_scored.json', JSON.stringify(results, null, 2), 'utf8');
console.log('\n저장 완료: weekly_cumulative_scored.json');
