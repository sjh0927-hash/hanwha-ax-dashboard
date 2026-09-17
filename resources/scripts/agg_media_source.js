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

function aggregate(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = parseCSV(text);
  const header = rows[0];
  const idxSrc = header.indexOf('Media Source (pid)');
  const idxInstalls = header.indexOf('Installs');
  const agg = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const src = row[idxSrc] || '(unknown)';
    const installs = parseInt(row[idxInstalls], 10) || 0;
    agg[src] = (agg[src] || 0) + installs;
  }
  return agg;
}

const file = process.argv[2];
const agg = aggregate(file);
const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]);
let total = 0;
for (const [k, v] of sorted) total += v;
console.log(`===== ${file} (total installs: ${total}) =====`);
for (const [k, v] of sorted) {
  console.log(`${v}\t${(v/total*100).toFixed(1)}%\t${k}`);
}
