// 08 — 소요시간·인기도 보강: tamnao_products_enriched.csv → data/spots.json
//
// tamnao 상품(관광지/레저)에 소요시간(min/typical/max)과 인기도(google/tamnao 리뷰,
// 베이지안 pop_score)를 붙입니다. visitjeju 스팟은 건드리지 않습니다(기존 stay_minutes 유지).
// 멱등입니다 — 값을 절대치로 덮어쓰므로 여러 번 실행해도 안전합니다.
//
// 실행: node scripts/08-enrich-spots.js
const fs = require('fs');
const path = require('path');

const CSV = path.join(__dirname, '../../tamnao_data/tamnao_products_enriched.csv');
const SPOTS = path.join(__dirname, '../data/spots.json');

// --- CSV 파싱 (전 필드 따옴표, 내부 쉼표 허용) ---
function parseCsv(text) {
  const rows = [];
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const f = []; let re = /"((?:[^"]|"")*)"/g, m;
    while ((m = re.exec(line)) !== null) f.push(m[1].replace(/""/g, '"'));
    if (f.length >= 4) rows.push(f);
  }
  return rows;
}
const rawCsv = fs.readFileSync(CSV, 'utf8');
const header = rawCsv.replace(/^﻿/, '').split(/\r?\n/)[0].split(',');
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const csv = parseCsv(rawCsv);

// --- 베이지안 인기도 상수 (매칭된 구글 데이터에서 도출) ---
const gRows = csv.map(r => ({
  rating: +r[col.google_rating] || null,
  count: +r[col.google_review_count] || 0,
})).filter(o => o.rating && o.count > 0);
const C = gRows.reduce((s, o) => s + o.rating, 0) / gRows.length; // 전역 평균 평점 ≈ 4.28
const M = 50;                                                     // 신뢰 임계 리뷰수
const logVmax = Math.log10(1 + Math.max(...gRows.map(o => o.count)));

// 탐나오 후기 상수 (구글 미매칭 상품의 폴백용, 표본 얇음)
const tRows = csv.map(r => ({ rating: +r[col.tamnao_rating] || null, count: +r[col.tamnao_review_count] || 0 }))
  .filter(o => o.rating && o.count > 0);
const Ct = tRows.length ? tRows.reduce((s, o) => s + o.rating, 0) / tRows.length : 4.5;
const Mt = 3;
const logVmaxT = Math.log10(1 + Math.max(1, ...tRows.map(o => o.count)));

// pop_score: 0.5*베이지안평점(정규화) + 0.5*log(리뷰수). 구글 우선, 없으면 탐나오, 둘 다 없으면 null.
function popScore(gR, gV, tV, tR) {
  if (gR && gV > 0) {
    const bayes = (gV / (gV + M)) * gR + (M / (gV + M)) * C;
    const bnorm = Math.max(0, Math.min(1, (bayes - 3.5) / 1.5));
    const mag = Math.log10(1 + gV) / logVmax;
    return { score: +(0.5 * bnorm + 0.5 * mag).toFixed(4), src: 'google' };
  }
  if (tR && tV > 0) {
    const bayes = (tV / (tV + Mt)) * tR + (Mt / (tV + Mt)) * Ct;
    const bnorm = Math.max(0, Math.min(1, (bayes - 3.5) / 1.5));
    const mag = Math.log10(1 + tV) / logVmaxT;
    // 탐나오 신호는 얇으므로 상한을 눌러 구글 기반 점수보다 위로 못 오게 함
    return { score: +Math.min(0.5, 0.5 * bnorm + 0.5 * mag).toFixed(4), src: 'tamnao' };
  }
  return { score: null, src: null };
}

// prdtNum -> 보강 데이터
const byNum = new Map();
for (const r of csv) {
  const num = r[0];
  const iv = k => { const v = r[col[k]]; return v === '' || v == null ? null : Math.round(+v); };
  const fv = k => { const v = r[col[k]]; return v === '' || v == null ? null : +v; };
  const p = popScore(fv('google_rating'), iv('google_review_count'), iv('tamnao_review_count'), fv('tamnao_rating'));
  byNum.set(num, {
    duration_min: iv('duration_min'),
    duration_typical: iv('duration_typical'),
    duration_max: iv('duration_max'),
    duration_source: r[col.duration_source] || null,
    google_rating: fv('google_rating'),
    google_review_count: iv('google_review_count'),
    tamnao_review_count: iv('tamnao_review_count'),
    pop_score: p.score,
  });
}

// --- spots.json 패치 ---
const spots = JSON.parse(fs.readFileSync(SPOTS, 'utf8'));
const NEW = ['duration_min', 'duration_typical', 'duration_max', 'duration_source',
  'google_rating', 'google_review_count', 'tamnao_review_count', 'pop_score'];

let patched = 0, tamnaoRows = 0;
for (const s of spots) {
  if (s.source !== 'tamnao') {
    // visitjeju: 신규 필드를 null로 채워 스키마 일관성 유지
    for (const k of NEW) if (!(k in s)) s[k] = null;
    continue;
  }
  tamnaoRows++;
  const num = s.id.replace(/^tn_/, '');
  const e = byNum.get(num);
  for (const k of NEW) s[k] = e ? e[k] : null;
  if (e) patched++;
}

fs.writeFileSync(SPOTS, JSON.stringify(spots, null, 1));

const withDur = spots.filter(s => s.source === 'tamnao' && s.duration_max != null).length;
const withPop = spots.filter(s => s.source === 'tamnao' && s.pop_score != null).length;
console.log(`상수: C=${C.toFixed(3)} M=${M} (탐나오 Ct=${Ct.toFixed(2)} Mt=${Mt})`);
console.log(`tamnao 행 ${tamnaoRows} (4언어) 중 매칭 ${patched} 패치`);
console.log(`  소요시간(duration_max) 보유: ${withDur} 행 | 인기도(pop_score) 보유: ${withPop} 행`);
console.log(`신규 컬럼 ${NEW.length}개 추가 → data/spots.json`);
