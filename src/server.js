// TAMRA PASS — API 서버 (의존성 0, Node 내장 모듈만)
// 실행: node server/server.js   →  http://localhost:8787/api/v1
import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 8787;

// ---------- DB ----------
// 로컬: npm run seed 로 만든 파일 DB를 사용
// 서버리스(Vercel): 파일 시스템이 읽기 전용이라 인메모리 DB를 콜드스타트에 채움
const DB_FILE = path.join(ROOT, 'tamrapass.db');
const useFileDb = !process.env.VERCEL && fs.existsSync(DB_FILE);
const db = new DatabaseSync(useFileDb ? DB_FILE : ':memory:');
if (!useFileDb) {
  const t0 = Date.now();
  const { seedInto } = await import('./seed-core.js');
  const n = seedInto(db);
  console.log(`[db] in-memory seed: spots ${n.spots} · goods ${n.goods} (${Date.now() - t0}ms)`);
}

// ---------- .env 로더 (의존성 없이) ----------
const ENV = (() => {
  const out = {};
  const f = path.join(ROOT, '.env');
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
})();
// 배포 환경에서는 플랫폼 환경변수가 우선, 로컬에서는 .env 파일
const MAPS_KEY =
  process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY ||
  ENV.VITE_GOOGLE_MAPS_API_KEY || ENV.GOOGLE_MAPS_API_KEY || '';

// 정적 파일 폴더 탐색 — 로컬과 서버리스 번들 양쪽 대응
const PUBLIC_DIR = [
  path.join(ROOT, 'public'),
  path.join(process.cwd(), 'public'),
  '/var/task/public',
].find(p => fs.existsSync(path.join(p, 'index.html'))) || path.join(ROOT, 'public');

// ---------- 공통 ----------
const LANGS = ['ko', 'en', 'ja', 'zh'];
const BUFFER_MIN = 90;              // CIQ·승하선 버퍼
const nowISO = () => new Date().toISOString();
const uid = p => p + '_' + crypto.randomBytes(5).toString('hex');
const num = (v, d) => (v == null || v === '' || isNaN(+v) ? d : +v);
const fmtTime = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const money = (n, lang = 'ko') => (lang === 'ko' ? n.toLocaleString('ko-KR') + '원' : '₩' + n.toLocaleString('en-US'));
// 직선거리 → 차량 소요시간 추정 (설계의 택시 로직과 동일 계수)
const driveMin = km => Math.max(6, Math.round(km * 2.4));
const hav = (a, b, c, d) => {
  const R = 6371, p = Math.PI / 180, dl = (c - a) * p, dn = (d - b) * p;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(dn / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const IMPORT_LABEL = {
  allowed:     { ko: '반입 가능',   en: 'OK to bring',      ja: '持込可',     zh: '可携带' },
  conditional: { ko: '조건부 반입', en: 'Conditions apply', ja: '条件付き',   zh: '有条件' },
  restricted:  { ko: '반입 제한',   en: 'Restricted',       ja: '制限',       zh: '受限' },
  prohibited:  { ko: '반입 불가',   en: 'Not allowed',      ja: '持込不可',   zh: '禁止携带' },
};
const DELIVERY_NOTE = {
  ship:             { ko: '출항 전까지 크루즈 선박으로 배송해 드릴게요.', en: "We'll deliver to your ship before departure.", ja: '出航前にクルーズ船へお届けします。', zh: '将在出航前配送至您的邮轮。' },
  port_pickup:      { ko: '항구 픽업 지점에서 수령하실 수 있어요.',       en: 'Pick up at the port pickup point.',            ja: '港のピックアップ地点で受取。',       zh: '可在港口取货点自取。' },
  current_location: { ko: '현재 위치로 배송해 드릴게요.',                 en: "We'll deliver to your current location.",      ja: '現在地へお届けします。',             zh: '将配送至您的当前位置。' },
};

class ApiError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra; }
}
const bad = (code, msg, extra) => { throw new ApiError(400, code, msg, extra); };
const notFound = (msg = '리소스를 찾을 수 없습니다.') => { throw new ApiError(404, 'NOT_FOUND', msg); };

const langOf = q => (LANGS.includes(q.get('lang')) ? q.get('lang') : 'ko');
const paging = q => {
  const page = Math.max(1, num(q.get('page'), 1));
  const size = Math.min(500, Math.max(1, num(q.get("size"), 20)));
  return { page, size, offset: (page - 1) * size };
};

// ---------- 직렬화 ----------
const spotRow = (r, portKey, availableMin) => {
  const km = portKey === 'gangjeong' ? r.dist_gangjeong_km : r.dist_jeju_km;
  const drive = km == null ? null : driveMin(km);
  const round = drive == null ? null : drive * 2 + r.stay_minutes;
  return {
    id: r.id, source: r.source,
    name: r.name,
    description: r.description || undefined,
    category: { key: r.category, label: r.category_label },
    lat: r.lat, lng: r.lng,
    address: r.address || '',
    thumbnail: r.thumbnail || '',
    distanceKm: km, driveMinutes: drive,
    stayMinutes: r.stay_minutes,
    roundTripMinutes: round,
    fitsWindow: availableMin != null && round != null ? round <= availableMin : undefined,
    bookable: !!r.bookable,
    langFallback: r.lang_fallback ? true : undefined,
    detailUrl: r.detail_url,
  };
};
const goodsRow = (g, lang) => ({
  id: g.id, name: g.name, description: g.description || '',
  category: g.category, categoryLabel: g.category_label,
  price: g.price, priceLabel: money(g.price, lang),
  thumbnail: g.thumbnail,
  importStatus: g.import_status,
  importLabel: (IMPORT_LABEL[g.import_status] || IMPORT_LABEL.allowed)[lang],
  customsNote: g.customs_note, cruiseLineNote: g.cruise_line_note,
  detailUrl: g.detail_url,
});
const cruiseRow = (c, lang) => {
  const port = db.prepare('SELECT * FROM ports WHERE key=?').get(c.port_key);
  return {
    id: c.id, line: c.line, ship: c.ship,
    port: { key: port.key, name: port['name_' + lang], lat: port.lat, lng: port.lng },
    arrival: c.arrival, departure: c.departure,
    stayMinutes: c.dep_m - c.arr_m,
    availableMinutes: Math.max(0, c.dep_m - c.arr_m - BUFFER_MIN),
    boardByTime: fmtTime(c.dep_m - 30),
    nextDestination: c['next_' + lang],
  };
};

// ---------- 라우트 ----------
const routes = [];
const on = (method, pattern, handler) => {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, rx, keys, handler });
};

// --- 온보딩 ---
on('GET', '/api/v1/ports', (ctx) => {
  const lang = langOf(ctx.q);
  return { items: db.prepare('SELECT * FROM ports').all().map(p => ({ key: p.key, name: p['name_' + lang], lat: p.lat, lng: p.lng })) };
});
on('GET', '/api/v1/cruises', (ctx) => {
  const lang = langOf(ctx.q);
  return { items: db.prepare('SELECT * FROM cruises').all().map(c => cruiseRow(c, lang)) };
});
on('GET', '/api/v1/cruises/:id', (ctx) => {
  const c = db.prepare('SELECT * FROM cruises WHERE id=?').get(ctx.params.id) || notFound('크루즈를 찾을 수 없습니다.');
  return cruiseRow(c, langOf(ctx.q));
});

// --- 스팟(지도) ---
function resolveWindow(q) {
  let portKey = q.get('port'), availableMin = null;
  const cruiseId = q.get('cruiseId');
  if (cruiseId) {
    const c = db.prepare('SELECT * FROM cruises WHERE id=?').get(cruiseId) || notFound('크루즈를 찾을 수 없습니다.');
    portKey = c.port_key;
    availableMin = Math.max(0, c.dep_m - c.arr_m - BUFFER_MIN);
  }
  if (q.get('maxMinutes')) availableMin = num(q.get('maxMinutes'), availableMin);
  if (portKey && !['jeju', 'gangjeong'].includes(portKey)) bad('INVALID_PARAM', "port는 'jeju' 또는 'gangjeong'이어야 합니다.");
  return { portKey: portKey || 'jeju', availableMin };
}

on('GET', '/api/v1/spots', (ctx) => {
  const q = ctx.q, lang = langOf(q);
  const { portKey, availableMin } = resolveWindow(q);
  const distCol = portKey === 'gangjeong' ? 'dist_gangjeong_km' : 'dist_jeju_km';

  const where = ['lang = ?', 'lat IS NOT NULL'], args = [lang];
  if (q.get('category') && q.get('category') !== 'all') { where.push('category = ?'); args.push(q.get('category')); }
  if (q.get('source')) { where.push('source = ?'); args.push(q.get('source')); }
  if (q.get('bookableOnly') === 'true') where.push('bookable = 1');
  if (q.get('q')) { where.push('name LIKE ?'); args.push('%' + q.get('q') + '%'); }
  if (q.get('bbox')) {
    const [s, w, n, e] = q.get('bbox').split(',').map(Number);
    if ([s, w, n, e].some(isNaN)) bad('INVALID_PARAM', 'bbox 형식은 south,west,north,east 입니다.');
    where.push('lat BETWEEN ? AND ?', 'lng BETWEEN ? AND ?'); args.push(s, n, w, e);
  }
  // 체류시간 필터: 왕복이동 + 체류 <= 가용시간   (driveMinutes = max(6, km*2.4))
  if (availableMin != null) {
    where.push(`(MAX(6, ROUND(${distCol} * 2.4)) * 2 + stay_minutes) <= ?`);
    args.push(availableMin);
  }
  const sql = `FROM spots WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c ${sql}`).get(...args).c;

  const sort = { distance: `${distCol} ASC`, name: 'name ASC' }[q.get('sort')] || `${distCol} ASC`;
  const { page, size, offset } = paging(q);
  const rows = db.prepare(`SELECT * ${sql} ORDER BY ${sort} LIMIT ? OFFSET ?`).all(...args, size, offset);

  // compact=1 — 지도 마커용 축약 응답 (전 지역을 한 번에 받기 위해 페이로드를 줄임)
  if (q.get('compact') === '1') {
    return {
      items: rows.map(r => ({
        id: r.id, name: r.name, lat: r.lat, lng: r.lng,
        category: r.category, bookable: r.bookable ? 1 : 0,
        km: portKey === 'gangjeong' ? r.dist_gangjeong_km : r.dist_jeju_km,
      })),
      page, size, totalCount: total,
      window: { port: portKey, availableMinutes: availableMin },
    };
  }

  return {
    items: rows.map(r => spotRow(r, portKey, availableMin)),
    page, size, totalCount: total,
    window: { port: portKey, availableMinutes: availableMin, bufferMinutes: BUFFER_MIN },
  };
});

on('GET', '/api/v1/spots/categories', (ctx) => {
  const lang = langOf(ctx.q);
  const rows = db.prepare(
    `SELECT category key, category_label label, COUNT(*) count FROM spots
     WHERE lang=? AND lat IS NOT NULL GROUP BY category ORDER BY count DESC`).all(lang);
  return { items: rows };
});

on('GET', '/api/v1/spots/:id', (ctx) => {
  const lang = langOf(ctx.q);
  const r = db.prepare('SELECT * FROM spots WHERE id=? AND lang=?').get(ctx.params.id, lang)
        || db.prepare("SELECT * FROM spots WHERE id=? AND lang='ko'").get(ctx.params.id)
        || notFound('스팟을 찾을 수 없습니다.');
  const { portKey, availableMin } = resolveWindow(ctx.q);
  return {
    ...spotRow(r, portKey, availableMin),
    description: r.description || '',
    phone: r.phone || '',
    images: [r.image || r.thumbnail].filter(Boolean),
    tags: r.tags ? r.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
  };
});

on('GET', '/api/v1/spots/:id/nearby', (ctx) => {
  const lang = langOf(ctx.q);
  const base = db.prepare('SELECT * FROM spots WHERE id=? AND lang=?').get(ctx.params.id, lang)
            || db.prepare("SELECT * FROM spots WHERE id=? AND lang='ko'").get(ctx.params.id)
            || notFound('스팟을 찾을 수 없습니다.');
  if (base.lat == null) return { items: [] };
  const radius = num(ctx.q.get('radius'), 3);
  const limit = Math.min(20, num(ctx.q.get('limit'), 4));
  const dLat = radius / 111, dLng = radius / (111 * Math.cos(base.lat * Math.PI / 180));
  const cand = db.prepare(
    `SELECT * FROM spots WHERE lang=? AND id<>? AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`
  ).all(lang, base.id, base.lat - dLat, base.lat + dLat, base.lng - dLng, base.lng + dLng);

  const items = cand.map(r => ({ r, km: hav(base.lat, base.lng, r.lat, r.lng) }))
    .filter(x => x.km <= radius).sort((a, b) => a.km - b.km).slice(0, limit)
    .map(({ r, km }) => ({
      id: r.id, name: r.name, type: r.category_label,
      description: r.description || '',
      distanceKm: Math.round(km * 10) / 10,
      walkMinutes: Math.max(1, Math.round(km * 12)),
      thumbnail: r.thumbnail || '', bookable: !!r.bookable,
      lat: r.lat, lng: r.lng, detailUrl: r.detail_url,
    }));
  return { items };
});

// --- AI 패키지 ---
on('POST', '/api/v1/packages', (ctx) => {
  const { cruiseId, spotIds, lang: l } = ctx.body || {};
  const lang = LANGS.includes(l) ? l : 'ko';
  if (!Array.isArray(spotIds) || !spotIds.length) bad('INVALID_PARAM', 'spotIds가 필요합니다.');
  const c = db.prepare('SELECT * FROM cruises WHERE id=?').get(cruiseId) || notFound('크루즈를 찾을 수 없습니다.');
  const port = db.prepare('SELECT * FROM ports WHERE key=?').get(c.port_key);
  const availableMin = Math.max(0, c.dep_m - c.arr_m - BUFFER_MIN);

  const spots = spotIds.map(id =>
    db.prepare('SELECT * FROM spots WHERE id=? AND lang=?').get(id, lang) ||
    db.prepare("SELECT * FROM spots WHERE id=? AND lang='ko'").get(id)
  ).filter(Boolean);
  if (!spots.length) notFound('선택한 스팟을 찾을 수 없습니다.');

  // 동선 최적화: 항구 출발 → 순회 → 항구 복귀 (≤7개는 완전탐색, 그 이상은 최근접이웃)
  const legMin = (a, b) => driveMin(hav(a.lat, a.lng, b.lat, b.lng));
  const P = { lat: port.lat, lng: port.lng };
  const cost = order => {
    let t = 0, cur = P;
    for (const s of order) { t += legMin(cur, s) + s.stay_minutes; cur = s; }
    return t + legMin(cur, P);
  };
  let best = spots;
  const usable = spots.filter(s => s.lat != null);
  if (usable.length >= 2 && usable.length <= 7) {
    const perm = (arr) => arr.length <= 1 ? [arr]
      : arr.flatMap((v, i) => perm([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [v, ...p]));
    best = perm(usable).reduce((b, o) => (cost(o) < cost(b) ? o : b), usable);
  } else if (usable.length > 7) {
    const rest = [...usable]; const out = []; let cur = P;
    while (rest.length) {
      let bi = 0; rest.forEach((s, i) => { if (legMin(cur, s) < legMin(cur, rest[bi])) bi = i; });
      cur = rest[bi]; out.push(cur); rest.splice(bi, 1);
    }
    best = out;
  }

  let clock = c.arr_m + 30, total = 0, cur = P;
  const itinerary = best.map((s, i) => {
    const move = legMin(cur, s);
    clock += move; total += move;
    const arriveAt = fmtTime(clock);
    clock += s.stay_minutes; total += s.stay_minutes;
    cur = s;
    return {
      no: i + 1, spotId: s.id, name: s.name,
      category: s.category_label, thumbnail: s.thumbnail || '',
      lat: s.lat, lng: s.lng,
      arriveAt, departAt: fmtTime(clock), stayMinutes: s.stay_minutes,
      moveFromPrevMinutes: move,
    };
  });
  const back = legMin(cur, P); clock += back; total += back;

  const pkg = {
    id: uid('pkg'), cruiseId: c.id,
    totalMinutes: total, availableMinutes: availableMin,
    fitsWindow: total <= availableMin,
    itinerary,
    returnToPort: { arriveAt: fmtTime(clock), moveMinutes: back, bufferMinutes: Math.max(0, availableMin - total) },
    port: { key: port.key, name: port['name_' + lang], lat: port.lat, lng: port.lng },
  };
  if (!pkg.fitsWindow) {
    const over = total - availableMin;
    pkg.suggestion = {
      message: `체류 가능 시간을 ${over}분 초과했어요. 아래 스팟을 빼면 일정이 맞습니다.`,
      removeSpotIds: [...best].sort((a, b) =>
        (driveMin(hav(P.lat, P.lng, b.lat, b.lng)) + b.stay_minutes) -
        (driveMin(hav(P.lat, P.lng, a.lat, a.lng)) + a.stay_minutes)).slice(0, 1).map(s => s.id),
    };
  }
  db.prepare(`INSERT INTO packages VALUES (?,?,?,?,?,?,?)`)
    .run(pkg.id, ctx.sessionId, c.id, JSON.stringify(spotIds), JSON.stringify(pkg), total, nowISO());
  logEvent(ctx.sessionId, 'package_created', pkg.id, lang, { total, fits: pkg.fitsWindow });
  return pkg;
});

on('GET', '/api/v1/packages/:id', (ctx) => {
  const r = db.prepare('SELECT * FROM packages WHERE id=?').get(ctx.params.id) || notFound('패키지를 찾을 수 없습니다.');
  return JSON.parse(r.itinerary_json);
});

// --- 파트너 / 예약 ---
on('GET', '/api/v1/partners', (ctx) => {
  const lang = langOf(ctx.q);
  return {
    items: db.prepare('SELECT * FROM partners').all().map(p => ({
      id: p.id, name: p['name_' + lang], role: p['role_' + lang], vehicle: p['car_' + lang],
      rating: p.rating, languages: p.languages.split(','), verified: !!p.verified,
      price: p.price, priceLabel: money(p.price, lang) + (lang === 'ko' ? ' ~' : ''),
    })),
  };
});
on('POST', '/api/v1/bookings', (ctx) => {
  const { packageId, partnerId } = ctx.body || {};
  const p = db.prepare('SELECT * FROM partners WHERE id=?').get(partnerId) || notFound('파트너를 찾을 수 없습니다.');
  const id = uid('bk');
  db.prepare(`INSERT INTO bookings VALUES (?,?,?,?,?,?)`).run(id, ctx.sessionId, packageId || null, partnerId, 'requested', nowISO());
  logEvent(ctx.sessionId, 'booking_created', id, 'ko', { partnerId });
  return { id, status: 'requested', partnerId: p.id };
});

// --- 쇼핑 ---
on('GET', '/api/v1/goods', (ctx) => {
  const q = ctx.q, lang = langOf(q);
  const where = [], args = [];
  const cat = q.get('category');
  if (cat && cat !== 'all') { where.push('category = ?'); args.push(cat); }
  if (q.get('importStatus')) { where.push('import_status = ?'); args.push(q.get('importStatus')); }
  if (q.get('q')) { where.push('name LIKE ?'); args.push('%' + q.get('q') + '%'); }
  const sql = 'FROM goods' + (where.length ? ' WHERE ' + where.join(' AND ') : '');
  const total = db.prepare(`SELECT COUNT(*) c ${sql}`).get(...args).c;
  const sort = { priceAsc: 'price ASC', priceDesc: 'price DESC', name: 'name ASC' }[q.get('sort')] || 'id ASC';
  const { page, size, offset } = paging(q);
  const rows = db.prepare(`SELECT * ${sql} ORDER BY ${sort} LIMIT ? OFFSET ?`).all(...args, size, offset);
  return { items: rows.map(g => goodsRow(g, lang)), page, size, totalCount: total };
});

on('GET', '/api/v1/goods/categories', (ctx) => {
  const lang = langOf(ctx.q);
  const L = { all: { ko: '전체', en: 'All', ja: 'すべて', zh: '全部' },
              food: { ko: '먹거리', en: 'Food', ja: '食品', zh: '食品' },
              cosmetics: { ko: '화장품', en: 'Cosmetics', ja: '化粧品', zh: '化妆品' },
              souvenir: { ko: '기념품', en: 'Souvenirs', ja: 'お土産', zh: '纪念品' } };
  const counts = db.prepare('SELECT category key, COUNT(*) count FROM goods GROUP BY category').all();
  const total = counts.reduce((a, c) => a + c.count, 0);
  return { items: [{ key: 'all', label: L.all[lang], count: total },
    ...counts.map(c => ({ key: c.key, label: (L[c.key] || {})[lang] || c.key, count: c.count }))] };
});

on('GET', '/api/v1/goods/:id', (ctx) => {
  const g = db.prepare('SELECT * FROM goods WHERE id=?').get(ctx.params.id) || notFound('상품을 찾을 수 없습니다.');
  logEvent(ctx.sessionId, 'goods_view', g.id, langOf(ctx.q), null);
  return goodsRow(g, langOf(ctx.q));
});

on('POST', '/api/v1/orders', (ctx) => {
  const { items, deliveryMethod = 'ship', importAgreed = false, lang: l } = ctx.body || {};
  const lang = LANGS.includes(l) ? l : 'ko';
  if (!Array.isArray(items) || !items.length) bad('INVALID_PARAM', '주문할 상품이 없습니다.');
  if (!DELIVERY_NOTE[deliveryMethod]) bad('INVALID_PARAM', 'deliveryMethod는 ship | port_pickup | current_location 입니다.');

  const detailed = items.map(i => {
    const g = db.prepare('SELECT * FROM goods WHERE id=?').get(i.goodsId) || notFound(`상품 ${i.goodsId}을(를) 찾을 수 없습니다.`);
    return { ...goodsRow(g, lang), qty: Math.max(1, num(i.qty, 1)) };
  });
  const restricted = detailed.filter(d => d.importStatus === 'restricted' || d.importStatus === 'prohibited');

  // ★ 반입 동의 게이트 — 프론트뿐 아니라 서버에서도 강제
  if (restricted.length && !importAgreed) {
    throw new ApiError(409, 'IMPORT_NOT_AGREED', '반입 규정 동의가 필요합니다.', {
      restrictedItems: restricted.map(r => ({ goodsId: r.id, name: r.name, importStatus: r.importStatus, customsNote: r.customsNote })),
    });
  }
  const total = detailed.reduce((a, d) => a + d.price * d.qty, 0);
  const id = uid('ord');
  db.prepare(`INSERT INTO orders VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, ctx.sessionId, JSON.stringify(detailed.map(d => ({ goodsId: d.id, qty: d.qty, price: d.price }))),
      total, deliveryMethod, importAgreed ? 1 : 0, 'paid', nowISO());
  logEvent(ctx.sessionId, 'order_placed', id, lang, { total, deliveryMethod });

  return {
    id, status: 'paid', totalPrice: total, totalPriceLabel: money(total, lang),
    deliveryMethod, deliveryNote: DELIVERY_NOTE[deliveryMethod][lang],
    items: detailed.map(d => ({ goodsId: d.id, name: d.name, qty: d.qty, price: d.price, importStatus: d.importStatus })),
    restrictedItems: restricted.map(r => ({ goodsId: r.id, name: r.name, importStatus: r.importStatus })),
  };
});

// --- 이동(택시) ---
on('GET', '/api/v1/taxi/estimate', (ctx) => {
  const lang = langOf(ctx.q);
  const portKey = ctx.q.get('port') || 'jeju';
  const port = db.prepare('SELECT * FROM ports WHERE key=?').get(portKey) || notFound('항구를 찾을 수 없습니다.');
  const s = db.prepare('SELECT * FROM spots WHERE id=? AND lang=?').get(ctx.q.get('spotId'), lang)
         || db.prepare("SELECT * FROM spots WHERE id=? AND lang='ko'").get(ctx.q.get('spotId'))
         || notFound('목적지 스팟을 찾을 수 없습니다.');
  if (s.lat == null) bad('INVALID_PARAM', '해당 스팟은 좌표가 없어 요금을 계산할 수 없습니다.');
  const km = hav(port.lat, port.lng, s.lat, s.lng);
  const fare = 4300 + Math.round(km) * 1700;
  return {
    from: { key: port.key, name: port['name_' + lang] }, to: { id: s.id, name: s.name },
    distanceKm: Math.round(km * 10) / 10, durationMinutes: driveMin(km),
    fare, fareLabel: money(fare, lang),
  };
});
on('POST', '/api/v1/taxi/requests', (ctx) => {
  const lang = LANGS.includes(ctx.body?.lang) ? ctx.body.lang : 'ko';
  const D = { name: { ko: '박준영', en: 'Junyoung Park', ja: 'パク·ジュンヨン', zh: '朴俊英' },
              car:  { ko: '쏘나타 (개인택시)', en: 'Sonata (private taxi)', ja: 'ソナタ(個人タクシー)', zh: '索纳塔（个人出租）' } };
  const id = uid('tx');
  logEvent(ctx.sessionId, 'taxi_called', id, lang, { spotId: ctx.body?.spotId });
  return { id, status: 'assigned', etaMinutes: 6,
    driver: { name: D.name[lang], vehicle: D.car[lang], plate: '제주 80바 3517', rating: 4.9 } };
});

// --- 행동 로그 / 통계 ---
function logEvent(sessionId, type, refId, lang, meta) {
  db.prepare(`INSERT INTO events (session_id,type,ref_id,lang,meta_json,created_at) VALUES (?,?,?,?,?,?)`)
    .run(sessionId || null, type, refId || null, lang || null, meta ? JSON.stringify(meta) : null, nowISO());
}
on('POST', '/api/v1/events', (ctx) => {
  const { type, refId, spotId, goodsId, lang, meta } = ctx.body || {};
  if (!type) bad('INVALID_PARAM', 'type이 필요합니다.');
  logEvent(ctx.sessionId, type, refId || spotId || goodsId || null, lang, meta);
  return { ok: true };
});
on('GET', '/api/v1/stats/summary', () => {
  const top = (type, table, idcol = 'id') => db.prepare(
    `SELECT e.ref_id id, COUNT(*) views, (SELECT name FROM ${table} WHERE ${idcol}=e.ref_id ${table === 'spots' ? "AND lang='ko'" : ''}) name
     FROM events e WHERE e.type=? AND e.ref_id IS NOT NULL GROUP BY e.ref_id ORDER BY views DESC LIMIT 5`).all(type);
  const dist = col => db.prepare(`SELECT ${col} k, COUNT(*) c FROM events WHERE ${col} IS NOT NULL GROUP BY ${col}`).all()
    .reduce((a, r) => (a[r.k] = r.c, a), {});
  const pk = db.prepare('SELECT AVG(total_minutes) a, COUNT(*) c FROM packages').get();
  const od = db.prepare('SELECT COUNT(*) c, COALESCE(SUM(total_price),0) s FROM orders').get();
  return {
    totalEvents: db.prepare('SELECT COUNT(*) c FROM events').get().c,
    topSpots: top('spot_view', 'spots'),
    topGoods: top('goods_view', 'goods'),
    packages: { count: pk.c, avgMinutes: pk.a ? Math.round(pk.a) : null },
    orders: { count: od.c, revenue: od.s },
    langDistribution: dist('lang'),
  };
});

// --- 헬스체크 ---
on('GET', '/api/v1/health', () => ({
  ok: true,
  spots: db.prepare("SELECT COUNT(*) c FROM spots WHERE lang='ko'").get().c,
  goods: db.prepare('SELECT COUNT(*) c FROM goods').get().c,
}));

// ---------- 요청 핸들러 ----------
// Vercel 함수(api/index.js)와 로컬 http 서버가 함께 사용합니다.
export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const send = (status, body) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204, {});

  // ---------- 정적 파일 (프론트) ----------
  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.join(PUBLIC_DIR, rel);
    if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file);
      const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                     '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' }[ext] || 'application/octet-stream';
      let content = fs.readFileSync(file);
      if (ext === '.html') content = content.toString('utf8').replaceAll('%%MAPS_KEY%%', MAPS_KEY);
      res.writeHead(200, { 'Content-Type': type });
      return res.end(content);
    }
  }

  const route = routes.find(r => r.method === req.method && r.rx.test(url.pathname));
  if (!route) return send(404, { error: { code: 'NOT_FOUND', message: `${req.method} ${url.pathname} 경로가 없습니다.` } });

  try {
    let body = null;
    if (req.method === 'POST') {
      const chunks = []; for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw) { try { body = JSON.parse(raw); } catch { bad('INVALID_PARAM', '요청 본문이 올바른 JSON이 아닙니다.'); } }
    }
    const m = url.pathname.match(route.rx);
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const ctx = { q: url.searchParams, params, body, sessionId: req.headers['x-session-id'] || null };
    send(200, route.handler(ctx));
  } catch (e) {
    if (e instanceof ApiError) return send(e.status, { error: { code: e.code, message: e.message, ...(e.extra || {}) } });
    console.error(e);
    send(500, { error: { code: 'INTERNAL', message: '서버 오류가 발생했습니다.' } });
  }
}

export default handler;

// ---------- 로컬 실행 ----------
// 서버리스(Vercel)에서는 상시 서버를 띄우지 않으므로 listen 하지 않습니다.
if (!process.env.VERCEL) {
  http.createServer(handler).listen(PORT, () => {
    console.log(`TAMRA PASS  →  http://localhost:${PORT}`);
    console.log(`  API   : http://localhost:${PORT}/api/v1/health`);
  });
}
