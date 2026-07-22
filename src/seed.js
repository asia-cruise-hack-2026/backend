// 로컬 개발용 — data/*.json 을 파일 SQLite(tamrapass.db)로 적재
// 실행: npm run seed
// (Vercel 등 서버리스에서는 파일 쓰기가 불가하므로 server.js가 인메모리로 자동 전환합니다)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedInto } from './seed-core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'tamrapass.db');

if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH);
const db = new DatabaseSync(DB_PATH);

const t0 = Date.now();
const n = seedInto(db);
db.close();

console.log('DB 생성:', DB_PATH);
console.log(`  spots ${n.spots}곳 · goods ${n.goods}개  (${Date.now() - t0}ms)`);
