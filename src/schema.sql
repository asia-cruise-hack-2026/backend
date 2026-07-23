-- TAMRA PASS — PostgreSQL 스키마 (Cloud SQL)
-- 실행: npm run seed  (내부에서 이 파일을 읽어 적용)

DROP TABLE IF EXISTS events, orders, bookings, packages, spots, goods, cruises, partners, ports CASCADE;

-- ---------- 콘텐츠 (읽기 전용, 시드로 채움) ----------
CREATE TABLE spots (
  id TEXT, lang TEXT, source TEXT,
  name TEXT, description TEXT,
  category TEXT, category_label TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  address TEXT, phone TEXT,
  thumbnail TEXT, image TEXT, tags TEXT,
  dist_jeju_km DOUBLE PRECISION, dist_gangjeong_km DOUBLE PRECISION, nearest_port TEXT,
  bookable INTEGER DEFAULT 0, price INTEGER,
  stay_minutes INTEGER DEFAULT 60,
  lang_fallback INTEGER DEFAULT 0,
  detail_url TEXT,
  -- 소요시간 추정 (탐나오 상세페이지 판독 + 유형 유추; null이면 stay_minutes 폴백)
  duration_min INTEGER, duration_typical INTEGER, duration_max INTEGER,
  duration_source TEXT,
  -- 인기도 (구글/탐나오 리뷰 + 베이지안 pop_score 0..1; 추천 정렬용)
  google_rating DOUBLE PRECISION, google_review_count INTEGER,
  tamnao_review_count INTEGER,
  pop_score DOUBLE PRECISION,
  PRIMARY KEY (id, lang)
);
CREATE INDEX idx_spots_lang ON spots(lang);
CREATE INDEX idx_spots_geo  ON spots(lat, lng);
CREATE INDEX idx_spots_dist ON spots(dist_jeju_km, dist_gangjeong_km);
CREATE INDEX idx_spots_pop  ON spots(pop_score);

CREATE TABLE goods (
  id TEXT PRIMARY KEY,
  name TEXT, description TEXT,
  category TEXT, category_label TEXT,
  price INTEGER, thumbnail TEXT, detail_url TEXT,
  import_status TEXT, customs_note TEXT, cruise_line_note TEXT
);
CREATE INDEX idx_goods_cat ON goods(category);

-- 제주도 해양산업과 선석배정 자료 기반 (실제 기항 스케줄)
CREATE TABLE cruises (
  id TEXT PRIMARY KEY, ship TEXT, port_key TEXT, berth TEXT,
  date TEXT, arrival TEXT, departure TEXT, arr_m INTEGER, dep_m INTEGER,
  stay_hours DOUBLE PRECISION, overnight INTEGER,
  gross_tonnage INTEGER, passengers INTEGER, note TEXT,
  next_ko TEXT, next_en TEXT, next_ja TEXT, next_zh TEXT,
  prev_ko TEXT, prev_en TEXT, prev_ja TEXT, prev_zh TEXT
);
CREATE INDEX idx_cruises_date ON cruises(date);
CREATE INDEX idx_cruises_port ON cruises(port_key);

CREATE TABLE ports (
  key TEXT PRIMARY KEY, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  name_ko TEXT, name_en TEXT, name_ja TEXT, name_zh TEXT
);
CREATE TABLE partners (
  id TEXT PRIMARY KEY, rating DOUBLE PRECISION, languages TEXT, price INTEGER, verified INTEGER,
  name_ko TEXT, name_en TEXT, name_ja TEXT, name_zh TEXT,
  role_ko TEXT, role_en TEXT, role_ja TEXT, role_zh TEXT,
  car_ko  TEXT, car_en  TEXT, car_ja  TEXT, car_zh  TEXT
);

-- ---------- 사용자 활동 (영구 보존 — Cloud SQL로 옮긴 이유) ----------
CREATE TABLE packages (
  id TEXT PRIMARY KEY, session_id TEXT, cruise_id TEXT,
  spot_ids TEXT, itinerary_json TEXT, total_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE bookings (
  id TEXT PRIMARY KEY, session_id TEXT, package_id TEXT, partner_id TEXT,
  status TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY, session_id TEXT, items_json TEXT,
  total_price INTEGER, delivery_method TEXT,
  import_agreed INTEGER, status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT, type TEXT, ref_id TEXT, lang TEXT, meta_json TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created ON events(created_at);
