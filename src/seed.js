// TAMRA PASS — DB 시드
// 실행: node server/seed.js
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'tamrapass.db');

if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH);
const db = new DatabaseSync(DB_PATH);

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

CREATE TABLE cruises (
  id TEXT PRIMARY KEY, line TEXT, ship TEXT, port_key TEXT,
  arrival TEXT, departure TEXT, arr_m INTEGER, dep_m INTEGER,
  next_ko TEXT, next_en TEXT, next_ja TEXT, next_zh TEXT
);
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
const spots = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'spots.json'), 'utf8'));
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
const goods = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'goods.json'), 'utf8'));
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

const insCruise = db.prepare(`INSERT INTO cruises VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
[
  ['msc','MSC Cruises','MSC Bellissima','jeju','08:00','18:00',480,1080,'후쿠오카, 일본','Fukuoka, Japan','福岡、日本','福冈, 日本'],
  ['adora','Adora Cruises','Adora Magic City','jeju','07:00','17:00',420,1020,'상하이, 중국','Shanghai, China','上海、中国','上海, 中国'],
  ['spectrum','Royal Caribbean','Spectrum of the Seas','gangjeong','09:00','19:00',540,1140,'나가사키, 일본','Nagasaki, Japan','長崎、日本','长崎, 日本'],
  ['diamond','Princess Cruises','Diamond Princess','jeju','08:00','20:00',480,1200,'부산, 대한민국','Busan, Korea','釜山、韓国','釜山, 韩国'],
  ['costa','Costa Cruises','Costa Serena','gangjeong','10:00','22:00',600,1320,'가고시마, 일본','Kagoshima, Japan','鹿児島、日本','鹿儿岛, 日本'],
].forEach(r => insCruise.run(...r));

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

const n = t => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
console.log('DB 생성:', DB_PATH);
console.log(`  spots ${n('spots')}행 (고유 ${db.prepare("SELECT COUNT(*) c FROM spots WHERE lang='ko'").get().c})`);
console.log(`  goods ${n('goods')} · cruises ${n('cruises')} · ports ${n('ports')} · partners ${n('partners')}`);
db.close();
