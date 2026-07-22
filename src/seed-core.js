// 시드 로직 — 파일 DB(로컬)와 인메모리 DB(Vercel) 양쪽에서 재사용
//
// 데이터는 fs 읽기가 아니라 정적 import로 가져옵니다.
// 서버리스 번들러는 fs 경로를 추적하지 못해 JSON이 누락되지만,
// import는 의존성으로 인식해 반드시 포함시키기 때문입니다.
import spotsData from '../data/spots.json' with { type: 'json' };
import goodsData from '../data/goods.json' with { type: 'json' };
import cruisesData from '../data/cruises.json' with { type: 'json' };

export function seedInto(db) {
  db.exec(`
  CREATE TABLE spots (
    id TEXT, lang TEXT, source TEXT,
    name TEXT, description TEXT,
    category TEXT, category_label TEXT,
    lat REAL, lng REAL, address TEXT, phone TEXT,
    thumbnail TEXT, image TEXT, tags TEXT,
    dist_jeju_km REAL, dist_gangjeong_km REAL, nearest_port TEXT,
    bookable INTEGER DEFAULT 0, price INTEGER,
    stay_minutes INTEGER DEFAULT 60,
    lang_fallback INTEGER DEFAULT 0,
    detail_url TEXT,
    PRIMARY KEY (id, lang)
  );
  CREATE INDEX idx_spots_lang ON spots(lang);
  CREATE INDEX idx_spots_geo  ON spots(lat, lng);
  CREATE INDEX idx_spots_dist ON spots(dist_jeju_km, dist_gangjeong_km);
  
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
    stay_hours REAL, overnight INTEGER, gross_tonnage INTEGER, passengers INTEGER,
    note TEXT,
    next_ko TEXT, next_en TEXT, next_ja TEXT, next_zh TEXT,
    prev_ko TEXT, prev_en TEXT, prev_ja TEXT, prev_zh TEXT
  );
  CREATE INDEX idx_cruises_date ON cruises(date);
  CREATE INDEX idx_cruises_port ON cruises(port_key);
  CREATE TABLE ports (
    key TEXT PRIMARY KEY, lat REAL, lng REAL,
    name_ko TEXT, name_en TEXT, name_ja TEXT, name_zh TEXT
  );
  CREATE TABLE partners (
    id TEXT PRIMARY KEY, rating REAL, languages TEXT, price INTEGER, verified INTEGER,
    name_ko TEXT, name_en TEXT, name_ja TEXT, name_zh TEXT,
    role_ko TEXT, role_en TEXT, role_ja TEXT, role_zh TEXT,
    car_ko  TEXT, car_en  TEXT, car_ja  TEXT, car_zh  TEXT
  );
  
  CREATE TABLE packages (
    id TEXT PRIMARY KEY, session_id TEXT, cruise_id TEXT,
    spot_ids TEXT, itinerary_json TEXT, total_minutes INTEGER, created_at TEXT
  );
  CREATE TABLE bookings (
    id TEXT PRIMARY KEY, session_id TEXT, package_id TEXT, partner_id TEXT,
    status TEXT, created_at TEXT
  );
  CREATE TABLE orders (
    id TEXT PRIMARY KEY, session_id TEXT, items_json TEXT,
    total_price INTEGER, delivery_method TEXT,
    import_agreed INTEGER, status TEXT, created_at TEXT
  );
  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT, type TEXT, ref_id TEXT, lang TEXT, meta_json TEXT, created_at TEXT
  );
  CREATE INDEX idx_events_type ON events(type);
  `);
  
  // ---------- spots ----------
  const spots = spotsData;
  const insSpot = db.prepare(`INSERT OR REPLACE INTO spots
   (id,lang,source,name,description,category,category_label,lat,lng,address,phone,
    thumbnail,image,tags,dist_jeju_km,dist_gangjeong_km,nearest_port,bookable,price,
    stay_minutes,lang_fallback,detail_url)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  for (const s of spots) {
    insSpot.run(s.id, s.lang, s.source, s.name, s.description, s.category, s.category_label,
      s.lat, s.lng, s.address, s.phone, s.thumbnail, s.image, s.tags,
      s.dist_jeju_km, s.dist_gangjeong_km, s.nearest_port, s.bookable, s.price,
      s.stay_minutes, s.lang_fallback, s.detail_url);
  }
  db.exec('COMMIT');
  
  // ---------- goods ----------
  const goods = goodsData;
  const insGoods = db.prepare(`INSERT OR REPLACE INTO goods
   (id,name,description,category,category_label,price,thumbnail,detail_url,
    import_status,customs_note,cruise_line_note) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  for (const g of goods) {
    insGoods.run(g.prdtNum, g.name, g.desc, g.shop_category, g.tamnao_category,
      g.price, g.thumbnail, g.url, g.import_status, g.customs_note, g.line_note);
  }
  db.exec('COMMIT');
  
  // ---------- ports / cruises / partners (설계 원본에서 이관) ----------
  const insPort = db.prepare(`INSERT INTO ports VALUES (?,?,?,?,?,?,?)`);
  insPort.run('jeju',      33.5230, 126.5370, '제주항',        'Jeju Port',      '済州港',       '济州港');
  insPort.run('gangjeong', 33.2246, 126.4790, '강정항 (서귀포)', 'Gangjeong Port', 'カンジョン港', '江汀港');
  
  const insCruise = db.prepare(`INSERT INTO cruises VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  for (const c of cruisesData) {
    insCruise.run(c.id, c.ship, c.portKey, c.berth,
      c.date, c.arrival, c.departure, c.arrM, c.depM,
      c.stayHours, c.overnight ? 1 : 0, c.grossTonnage, c.passengers, c.note,
      c.nextPort.ko, c.nextPort.en, c.nextPort.ja, c.nextPort.zh,
      c.prevPort.ko, c.prevPort.en, c.prevPort.ja, c.prevPort.zh);
  }
  db.exec('COMMIT');
  
  const insPartner = db.prepare(`INSERT INTO partners VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  [
    ['van',4.9,'ko,en',120000,1,'김성호','Seongho Kim','キム·ソンホ','金成浩',
     '미니밴 기사','Minivan driver','ミニバン運転手','商务车司机',
     '카니발 9인승','Carnival 9-seater','カーニバル9人乗','嘉华9座'],
    ['taxi',4.8,'ko,en,zh',90000,0,'이정민','Jeongmin Lee','イ·ジョンミン','李正民',
     '개인택시 기사','Private taxi','個人タクシー','个人出租车',
     '쏘나타 세단','Sonata sedan','ソナタ','索纳塔'],
    ['semi',4.9,'ko,en,ja,zh',150000,1,'제주올레 세미패키지','Jeju Olle Semi-package','済州オルレ·セミパッケージ','济州偶来半包团',
     '탐나오 공식 가이드 투어','Tamnao official guided tour','Tamnao公式ガイドツアー','Tamnao官方向导团',
     '가이드 + 차량','Guide + vehicle','ガイド+車両','向导+车辆'],
  ].forEach(r => insPartner.run(...r));
  
  return {
    spots: db.prepare("SELECT COUNT(*) c FROM spots WHERE lang='ko'").get().c,
    goods: db.prepare('SELECT COUNT(*) c FROM goods').get().c,
  };
}
