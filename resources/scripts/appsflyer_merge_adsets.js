const fs = require('fs');

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}

// normalize per 2026-09-14/09-16 established rule: literal token replace, case-insensitive, NO \b (word boundary breaks on 한글+언더스코어)
function stripTokenCI(s, token) {
  // token has no regex-special chars (aos_/ios_/_aos/_ios/"aos "/"ios "/_안드로이드 etc.) so literal use as regex source is safe
  const re = new RegExp(token, 'gi');
  return s.replace(re, '');
}
function normalize(label) {
  if (!label) return '(no adset)';
  let s = label;
  const tokens = ['aos_', 'ios_', '_aos', '_ios', 'aos ', 'ios ', ' aos', ' ios', '_안드로이드', '_iOS'];
  for (const t of tokens) s = stripTokenCI(s, t);
  s = s.split(/\s+/).join(' ').trim();
  s = s.replace(/[_\s]+$/,'').replace(/^[_\s]+/,'');
  s = s.replace(/\[\s*\]/,'').trim();
  return s || '(no adset)';
}

function loadAdsets(file, platformLabel) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = parseCSV(text);
  const header = rows[0];
  const idxAdset = header.indexOf('Adset');
  const idxMediaSource = header.indexOf('Media Source');
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const adset = (row[idxAdset] || '').trim();
    if (!adset) continue; // skip installs w/o adset (organic, kakao channels etc.)
    out.push({ adset, mediaSource: row[idxMediaSource] });
  }
  return out;
}

const aosFile = process.argv[2];
const iosFile = process.argv[3];

const aosRows = loadAdsets(aosFile, 'aos');
const iosRows = loadAdsets(iosFile, 'ios');

const combined = {}; // normalizedLabel -> {aos, ios, rawLabels:Set}
for (const r of aosRows) {
  const norm = normalize(r.adset);
  if (!combined[norm]) combined[norm] = { aos: 0, ios: 0, raw: new Set() };
  combined[norm].aos++;
  combined[norm].raw.add(r.adset);
}
for (const r of iosRows) {
  const norm = normalize(r.adset);
  if (!combined[norm]) combined[norm] = { aos: 0, ios: 0, raw: new Set() };
  combined[norm].ios++;
  combined[norm].raw.add(r.adset);
}

const list = Object.entries(combined).map(([label, v]) => ({ label, aos: v.aos, ios: v.ios, total: v.aos + v.ios, raw: [...v.raw] }));
list.sort((a, b) => b.total - a.total);

let totalAll = 0;
for (const item of list) totalAll += item.total;

console.log(`Total adset-attributed installs: aos_rows=${aosRows.length} ios_rows=${iosRows.length} combined_labels=${list.length} total=${totalAll}`);
console.log('---- top 15 ----');
for (const item of list.slice(0, 15)) {
  console.log(`${item.total}\t(aos:${item.aos} ios:${item.ios})\t${item.label}\t  [raw: ${item.raw.join(' | ')}]`);
}
console.log('---- rest sum (rank 11+) ----');
const rest = list.slice(10);
const restAos = rest.reduce((s,r)=>s+r.aos,0);
const restIos = rest.reduce((s,r)=>s+r.ios,0);
console.log(`rest count=${rest.length} aos=${restAos} ios=${restIos} total=${restAos+restIos}`);
