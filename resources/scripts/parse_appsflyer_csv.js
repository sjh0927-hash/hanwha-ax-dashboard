#!/usr/bin/env node
// AppsFlyer partners_report(v5) CSV를 파싱해서 Google Ads / Facebook Ads 행만 요약 출력.
// 사용법: node parse_appsflyer_csv.js <csv들이 있는 디렉토리>
//
// CSV는 인용부호 포함 필드가 있어서 단순 split(',')로는 깨짐 - 아래 파서가 처리함.
const fs = require('fs');
const path = require('path');
const dir = process.argv[2] || '.';

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

const files = fs.readdirSync(dir).filter(f => f.startsWith('appsflyer_') && f.endsWith('.csv'));
const cols = ["Media Source (pid)", "Campaign (c)", "Impressions", "Clicks", "CTR", "Installs",
  "Sessions", "Total Revenue", "Total Cost", "ROI", "Average eCPI"];

for (const f of files) {
  const full = path.join(dir, f);
  const text = fs.readFileSync(full, 'utf8').replace(/^﻿/, '');
  const rows = parseCSV(text);
  const header = rows[0];
  const idx = name => header.indexOf(name);
  console.log(`\n===== ${f} (${rows.length - 1} data rows) =====`);
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const src = (row[idx('Media Source (pid)')] || '').toLowerCase();
    if (src.includes('google') || src.includes('facebook') || src.includes('fb')) {
      const obj = {};
      for (const c of cols) obj[c] = row[idx(c)];
      console.log(obj);
    }
  }
}
