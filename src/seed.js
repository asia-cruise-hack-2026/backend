// data/*.json → Cloud SQL (PostgreSQL) 적재
// 실행: npm run seed
//
// 스키마를 새로 만들고(DROP → CREATE) 콘텐츠 데이터를 넣습니다.
// 사용자 활동 테이블(orders/events/packages/bookings)은 비워진 채로 시작합니다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

import spotsData from '../data/spots.json' with { type: 'json' };
import goodsData from '../data/goods.json' with { type: 'json' };
import cruisesData from '../data/cruises.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 여러 행을 한 번의 INSERT로 — 수천 건을 한 건씩 넣으면 매우 느립니다.
async function bulkInsert(client, table, columns, rows, chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params = [];
    const values = chunk.map(r => {
      const ph = r.map(v => { params.push(v); return `$${params.length}`; });
      return `(${ph.join(',')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${values.join(',')}`,
      params
    );
  }
}

const t0 = Date.now();
const client = await pool.connect();
try {
  console.log('스키마 생성…');
  await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  console.log(`spots 적재… (${spotsData.length}행)`);
  await bulkInsert(client, 'spots',
    ['id','lang','source','name','description','category','category_label','lat','lng','address','phone',
     'thumbnail','image','tags','dist_jeju_km','dist_gangjeong_km','nearest_port','bookable','price',
     'stay_minutes','lang_fallback','detail_url'],
    spotsData.map(s => [s.id, s.lang, s.source, s.name, s.description, s.category, s.category_label,
      s.lat, s.lng, s.address, s.phone, s.thumbnail, s.image, s.tags,
      s.dist_jeju_km, s.dist_gangjeong_km, s.nearest_port, s.bookable, s.price,
      s.stay_minutes, s.lang_fallback, s.detail_url]));

  console.log(`goods 적재… (${goodsData.length}행)`);
  await bulkInsert(client, 'goods',
    ['id','name','description','category','category_label','price','thumbnail','detail_url',
     'import_status','customs_note','cruise_line_note'],
    goodsData.map(g => [g.prdtNum, g.name, g.desc, g.shop_category, g.tamnao_category,
      g.price, g.thumbnail, g.url, g.import_status, g.customs_note, g.line_note]));

  console.log(`cruises 적재… (${cruisesData.length}행)`);
  await bulkInsert(client, 'cruises',
    ['id','ship','port_key','berth','date','arrival','departure','arr_m','dep_m',
     'stay_hours','overnight','gross_tonnage','passengers','note',
     'next_ko','next_en','next_ja','next_zh','prev_ko','prev_en','prev_ja','prev_zh'],
    cruisesData.map(c => [c.id, c.ship, c.portKey, c.berth, c.date, c.arrival, c.departure, c.arrM, c.depM,
      c.stayHours, c.overnight ? 1 : 0, c.grossTonnage, c.passengers, c.note,
      c.nextPort.ko, c.nextPort.en, c.nextPort.ja, c.nextPort.zh,
      c.prevPort.ko, c.prevPort.en, c.prevPort.ja, c.prevPort.zh]));

  console.log('ports / partners 적재…');
  await bulkInsert(client, 'ports',
    ['key','lat','lng','name_ko','name_en','name_ja','name_zh'],
    [['jeju', 33.5230, 126.5370, '제주항', 'Jeju Port', '済州港', '济州港'],
     ['gangjeong', 33.2246, 126.4790, '강정항 (서귀포)', 'Gangjeong Port', 'カンジョン港', '江汀港']]);

  await bulkInsert(client, 'partners',
    ['id','rating','languages','price','verified',
     'name_ko','name_en','name_ja','name_zh','role_ko','role_en','role_ja','role_zh',
     'car_ko','car_en','car_ja','car_zh'],
    [['van',4.9,'ko,en',120000,1,'김성호','Seongho Kim','キム·ソンホ','金成浩',
      '미니밴 기사','Minivan driver','ミニバン運転手','商务车司机',
      '카니발 9인승','Carnival 9-seater','カーニバル9人乗','嘉华9座'],
     ['taxi',4.8,'ko,en,zh',90000,0,'이정민','Jeongmin Lee','イ·ジョンミン','李正民',
      '개인택시 기사','Private taxi','個人タクシー','个人出租车',
      '쏘나타 세단','Sonata sedan','ソナタ','索纳塔'],
     ['semi',4.9,'ko,en,ja,zh',150000,1,'제주올레 세미패키지','Jeju Olle Semi-package','済州オルレ·セミパッケージ','济州偶来半包团',
      '탐나오 공식 가이드 투어','Tamnao official guided tour','Tamnao公式ガイドツアー','Tamnao官方向导团',
      '가이드 + 차량','Guide + vehicle','ガイド+車両','向导+车辆']]);

  const n = async t => (await client.query(`SELECT COUNT(*)::int c FROM ${t}`)).rows[0].c;
  console.log(`\n완료 (${Date.now() - t0}ms)`);
  console.log(`  spots ${await n('spots')} · goods ${await n('goods')} · cruises ${await n('cruises')}`);
  console.log(`  ports ${await n('ports')} · partners ${await n('partners')}`);
} finally {
  client.release();
  await pool.end();
}
