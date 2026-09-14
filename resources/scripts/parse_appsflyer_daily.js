#!/usr/bin/env node
// AppsFlyer daily_report(v5) CSV를 파싱해서 날짜별 Installs/Loyal Users 합계를 출력.
// (partners_report와 달리 Date 컬럼이 있어 일자별 분해가 가능함)
// 사용법: node parse_appsflyer_daily.js <파일경로.csv> [<파일경로2.csv> ...]
//
// CSV는 인용부호 포함 필드가 있어서 단순 split(',')로는 깨짐 - 아래 파서가 처리함.
const fs = require('fs');
const path = require('path');
const files = process.argv.slice(2);

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

function num(v) {
  if (v === undefined || v === 'N/A' || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

for (const full of files) {
  const text = fs.readFileSync(full, 'utf8').replace(/^﻿/, '');
  const rows = parseCSV(text);
  const header = rows[0];
  const idx = name => header.indexOf(name);
  const iDate = idx('Date'), iInstalls = idx('Installs'), iLoyal = idx('Loyal Users');

  const byDate = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const d = row[iDate];
    if (!d) continue;
    if (!byDate[d]) byDate[d] = { installs: 0, loyal: 0 };
    byDate[d].installs += num(row[iInstalls]);
    byDate[d].loyal += num(row[iLoyal]);
  }

  console.log(`\n===== ${path.basename(full)} =====`);
  Object.keys(byDate).sort().forEach(d => {
    console.log(`${d}: installs=${byDate[d].installs} loyal=${byDate[d].loyal}`);
  });
}
