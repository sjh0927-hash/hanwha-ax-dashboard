const fs = require('fs');

const raw = JSON.parse(fs.readFileSync(__dirname + '/weekly_cumulative_data.json', 'utf8').replace(/^﻿/, ''));

// 위클리(w) 벤치마크 — generate-tv-score 스킬의 실제 구현 기준(0706 검증본)과 동일. 7일차 전용.
const BENCH_W = { nat_pct: 0.317, nat_abs: 100196, vr: 0.184, ctr: 0.0364, eng: 2500, sub: 180 };
const WEIGHTS_7D = { nat: 0.30, vr: 0.25, ctr: 0.20, eng: 0.15, sub: 0.10 };

// 1일차 벤치마크 — generate-tv-score 스킬도 7일차만 검증돼 있어 참조할 외부 기준이 없다.
// 1일차는 구독자 위주 초기 유입이라 자연유입비중·조회율·CTR이 7일차보다 구조적으로 훨씬 높게
// 나오는데(예: 자연유입비중 1일차 평균 54% vs 7일차 벤치마크 31.7%), 7일차 벤치마크를 그대로
// 쓰면 거의 전 편이 만점 처리돼 변별력이 사라진다. 그래서 위클리 자체 66편(VR·참여도 결측 없는
// 시즌1,2,3,4,6)의 1일차 평균값으로 직접 도출했다.
const BENCH_1D = { nat_pct: 0.541, nat_abs: 44929, vr: 0.293, ctr: 0.0454, eng: 1477, sub: 165, watch_min: 14.71 };

// 1일차 가중치 — 위클리 66편에서 "1일차 지표값이 최종(7일차) LTV Score를 얼마나 잘 예측하는지"
// (상관계수 r) 확인해보니: 참여도 r=0.79, 평균시청시간 r=0.61(공식에 없던 지표), 자연유입 r=0.55~0.63,
// 조회율 r=0.43, 구독자 r=0.20, CTR r=0.09(1일차엔 대부분 구독자 피드 노출이라 편차가 거의 없어 변별력
// 없음) 순. 그래서 평균시청시간을 6번째 항목으로 추가했다 — 그 몫(r² 비례, 23.6%)만 새로 산정하고
// 나머지 5개는 7일차와 동일한 상대비율(30:25:20:15:10)을 유지한 채 남은 비중(76.4%)에 맞춰 축소했다.
// CTR·참여도의 상대적 비중 자체를 바꾸는 문제는 별도 논의 사항이라 이번엔 건드리지 않았다.
const WEIGHTS_1D = { nat: 0.229, vr: 0.191, ctr: 0.153, eng: 0.115, sub: 0.076, watch: 0.236 };

function N(v, bench) {
  if (v == null || isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v / (bench * 2)));
}

// suf: '7d' | '1d'. hasTrafficBonus: 알고리즘/검색 유입 보너스는 7일차 트래픽소스 컬럼만
// 존재해서(1일차 원본 데이터 자체가 없음) 1일차 계산에서는 뺀다.
// 자연유입율(nat_pct)은 이 채널 트래픽소스 구조상 nat_pct_7d + ads_pct_7d = 1(항등식)이라,
// 사실상 "이 편에 광고를 얼마나 썼는지"의 거울상이다 — 콘텐츠 품질 신호가 아니라 미디어 예산
// 배분을 반영한다(실측: 80편 상관계수 -1.000). 반면 자연유입 절대값(nat_abs)은 광고 조회수와
// 거의 무관해서(상관계수 0.055) 광고 집행과 독립적인 순수 도달 신호에 가깝다. 그래서 유입율:
// 절대값 비중을 5:5에서 1:9로 낮춰 광고비 왜곡 영향을 줄인다(사용자 시뮬레이션 검증 후 결정).
function calcScore(ep, suf, bench, weights, hasTrafficBonus) {
  const nNatPct = N(ep['nat_pct_' + suf], bench.nat_pct);
  const nNatAbs = N(ep['nat_abs_' + suf], bench.nat_abs);
  const nNat = nNatPct * 0.1 + nNatAbs * 0.9;
  const nVr = N(ep['vr_' + suf], bench.vr);
  const nCtr = N(ep['ctr_' + suf], bench.ctr);
  const nEng = N(ep['eng_' + suf], bench.eng);
  const nSub = N(ep['sub_' + suf], bench.sub);
  const nWatch = weights.watch ? N(ep['watch_min_' + suf], bench.watch_min) : 0;

  const base = nNat * weights.nat + nVr * weights.vr + nCtr * weights.ctr + nEng * weights.eng
    + nSub * weights.sub + nWatch * (weights.watch || 0);

  // 보너스는 "벤치마크(평균 수준) 이상", 페널티는 "벤치마크의 절반 미만" — 7일차 공식의
  // 0.30(≈bench.nat_pct 0.317)·0.10·0.02(≈bench.vr·ctr의 절반) 기준을 그대로 일반화한 것.
  const vrVal = ep['vr_' + suf], subVal = ep['sub_' + suf], ctrVal = ep['ctr_' + suf];
  const b_org = ep['nat_pct_' + suf] >= bench.nat_pct ? 0.05 : 0;
  let b_algo = 0, b_srch = 0;
  if (hasTrafficBonus) {
    b_algo = Math.min(0.05, (ep.algo_pct_7d || 0) * 0.5);
    b_srch = Math.min(0.03, (ep.srch_pct_7d || 0) * 0.6);
  }

  // vr>0 가드: 결측(0)을 "실측했는데 낮음"으로 착각해 이중 페널티(기본점수 0점 + 페널티)를
  // 매기는 걸 막는다. 결측이면 기본점수에서 이미 0점 처리되니 추가 페널티는 불필요.
  let pen = 0;
  if (vrVal != null && vrVal > 0 && vrVal < bench.vr / 2) pen += 0.025;
  if (subVal != null && subVal < 0) pen += 0.025;
  if (ctrVal != null && ctrVal < bench.ctr / 2) pen += 0.025;
  pen = Math.min(0.05, pen);

  const v2 = base + b_org + b_algo + b_srch - pen;
  return {
    v2: +v2.toFixed(3),
    nNat: +nNat.toFixed(3), nVr: +nVr.toFixed(3), nCtr: +nCtr.toFixed(3), nEng: +nEng.toFixed(3), nSub: +nSub.toFixed(3), nWatch: +nWatch.toFixed(3),
    b_org: +b_org.toFixed(3), b_algo: +b_algo.toFixed(3), b_srch: +b_srch.toFixed(3), pen: +pen.toFixed(3),
  };
}
function calcLTV(ep) { return calcScore(ep, '7d', BENCH_W, WEIGHTS_7D, true); }
function calcLTV1d(ep) { return calcScore(ep, '1d', BENCH_1D, WEIGHTS_1D, false); }

// 등급은 절대 점수가 아니라 위클리 전체 편수 내 백분위(상대평가) 기준.
// 채널 전체 벤치마크 대비로는 위클리가 구조적으로 잘 나와 S/A에 쏠리기 때문에,
// 위클리 안에서 편끼리 비교하는 용도로는 자체 분포의 백분위 지점을 기준으로 나눈다.
// 등급 비중: S 상위 10% · A 다음 25%(상위 35%) · B+ 다음 30%(상위 65%) · B 다음 25%(상위 90%) · C 하위 10%.
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

// 장기 성장 지수 — 28일차 전용 점수공식 대신, "시간이 지나도 계속 발견되는 콘텐츠"만 가볍게
// 잡아내는 보조 배지. 발행 후 28일이 안 지난 편은 views_28d가 0으로 들어와 있어 집계대기 처리.
function calcGrowth28(ep) {
  const pending = !ep.views_28d || ep.views_28d <= 0;
  const growth_28d = pending ? null : +(ep.views_28d / ep.views_7d).toFixed(3);
  return { growth_28d, growth28_pending: pending };
}

const scored = raw.map(ep => ({ ...ep, ...calcLTV(ep), ...renameKeys(calcLTV1d(ep), '_1d'), ...calcGrowth28(ep) }));
const cut7d = percentileCut(scored.map(r => r.v2));
const cut1d = percentileCut(scored.map(r => r.v2_1d));

function renameKeys(obj, suffix) {
  const out = {};
  Object.keys(obj).forEach(k => { out[k + suffix] = obj[k]; });
  return out;
}

const results = scored.map(r => ({ ...r, grade: gradeFromCut(r.v2, cut7d), grade_1d: gradeFromCut(r.v2_1d, cut1d) }));

results.sort((a, b) => b.v2 - a.v2);
console.log('등급 기준 7일차(위클리 백분위):', `S≥${cut7d.p90.toFixed(3)}`, `A≥${cut7d.p65.toFixed(3)}`, `B+≥${cut7d.p35.toFixed(3)}`, `B≥${cut7d.p10.toFixed(3)}`, `C<${cut7d.p10.toFixed(3)}`);
console.log('등급 기준 1일차(위클리 백분위):', `S≥${cut1d.p90.toFixed(3)}`, `A≥${cut1d.p65.toFixed(3)}`, `B+≥${cut1d.p35.toFixed(3)}`, `B≥${cut1d.p10.toFixed(3)}`, `C<${cut1d.p10.toFixed(3)}`);

// 검증 출력
const counts = { S: 0, A: 0, 'B+': 0, B: 0, C: 0 };
results.forEach(r => counts[r.grade]++);
console.log('총편수:', results.length, '7일차 등급분포:', counts);
console.log('채널평균 LTV(7일차):', (results.reduce((s, r) => s + r.v2, 0) / results.length).toFixed(4));
console.log('채널평균 LTV(1일차):', (results.reduce((s, r) => s + r.v2_1d, 0) / results.length).toFixed(4));

// 1일차 순위와 7일차 순위가 얼마나 다른지 — "초기반응이 실제 성과를 얼마나 잘 예측했나" 확인용
const byV2_7d = [...results].sort((a, b) => b.v2 - a.v2);
const byV2_1d = [...results].sort((a, b) => b.v2_1d - a.v2_1d);
const top10_7d = new Set(byV2_7d.slice(0, 10).map(r => r.season + r.num));
const top10_1d = byV2_1d.slice(0, 10);
const overlap = top10_1d.filter(r => top10_7d.has(r.season + r.num)).length;
console.log(`1일차 TOP10과 7일차 TOP10 겹치는 편수: ${overlap}/10`);

const growthPendingCount = results.filter(r => r.growth28_pending).length;
const topGrowth = [...results].filter(r => !r.growth28_pending).sort((a, b) => b.growth_28d - a.growth_28d).slice(0, 5);
console.log(`장기 성장 지수(28d/7d) — 집계대기 ${growthPendingCount}편 제외, TOP5:`);
topGrowth.forEach(r => console.log(`  ${r.season.replace('위클리 ', '')} ${r.num} ${r.title}: x${r.growth_28d}`));

const bySeason = {};
results.forEach(r => {
  if (!bySeason[r.season]) bySeason[r.season] = [];
  bySeason[r.season].push(r);
});
Object.keys(bySeason).sort().forEach(s => {
  const arr = bySeason[s];
  const avg = arr.reduce((sum, r) => sum + r.v2, 0) / arr.length;
  const avg1d = arr.reduce((sum, r) => sum + r.v2_1d, 0) / arr.length;
  const g = { S: 0, A: 0, 'B+': 0, B: 0, C: 0 };
  arr.forEach(r => g[r.grade]++);
  console.log(`${s}: ${arr.length}편, 평균(7d) ${avg.toFixed(3)} / 평균(1d) ${avg1d.toFixed(3)}, S${g.S} A${g.A} B+${g['B+']} B${g.B} C${g.C}`);
});

fs.writeFileSync(__dirname + '/weekly_cumulative_scored.json', JSON.stringify(results, null, 2), 'utf8');
console.log('\n저장 완료: weekly_cumulative_scored.json');
