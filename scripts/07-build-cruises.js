// 제주도 크루즈 선석배정(xlsx) → data/cruises.json
//
// 출처: 제주특별자치도 해양산업과 「크루즈선석배정 변경알림」
//       https://www.jeju.go.kr/group/part11/change.htm
//       (갱신본이 올라오면 최신 xlsx를 받아 이 스크립트를 다시 실행하면 됩니다)
//
// 사용법:  node scripts/07-build-cruises.js "경로/2026년도 선석배정(알림)-260718.xlsx"
//
// 의존성 0 — xlsx(zip+xml)를 zlib로 직접 읽습니다.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- 최소 ZIP 리더 ---------- */
function unzip(file) {
  const buf = fs.readFileSync(file);
  // End of Central Directory 찾기
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP 구조를 읽을 수 없습니다: ' + file);
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    // local header에서 실제 데이터 시작 위치 계산
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    files[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/* ---------- 최소 XLSX 파서 ---------- */
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

const colNum = ref => {
  const m = ref.match(/^([A-Z]+)/); let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

function sheetRows(files, sheetPath) {
  const ssXml = files['xl/sharedStrings.xml'] ? files['xl/sharedStrings.xml'].toString('utf8') : '';
  const ss = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => decode(t[1])).join(''));
  const xml = files[sheetPath].toString('utf8');
  const rows = [];
  for (const rm of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cm of rm[2].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = (cm[1].match(/r="([A-Z]+\d+)"/) || [])[1];
      const type = (cm[1].match(/t="([^"]+)"/) || [])[1];
      let val = null;
      if (type === 'inlineStr') {
        val = [...cm[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => decode(t[1])).join('');
      } else {
        const v = (cm[2].match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (v != null) val = type === 's' ? (ss[+v] ?? '') : v;
      }
      if (ref != null) cells[colNum(ref)] = val;
    }
    rows[+rm[1] - 1] = cells;
  }
  return rows;
}

/* ---------- 항구명 다국어 ---------- */
// 스케줄에 등장하는 27개 항구. 없는 항구는 원문(영문)을 그대로 씁니다.
const PORT_I18N = {
  'Shanghai, CN': ['상하이, 중국', 'Shanghai, China', '上海、中国', '上海, 中国'],
  'Busan, KR':    ['부산, 대한민국', 'Busan, Korea', '釜山、韓国', '釜山, 韩国'],
  'Tianjin, CN':  ['톈진, 중국', 'Tianjin, China', '天津、中国', '天津, 中国'],
  'Incheon, KR':  ['인천, 대한민국', 'Incheon, Korea', '仁川、韓国', '仁川, 韩国'],
  'Nagasaki, JP': ['나가사키, 일본', 'Nagasaki, Japan', '長崎、日本', '长崎, 日本'],
  'Tokyo, JP':    ['도쿄, 일본', 'Tokyo, Japan', '東京、日本', '东京, 日本'],
  'Dalian, CN':   ['다롄, 중국', 'Dalian, China', '大連、中国', '大连, 中国'],
  'Yokohama, JP': ['요코하마, 일본', 'Yokohama, Japan', '横浜、日本', '横滨, 日本'],
  'Qingdao, CN':  ['칭다오, 중국', 'Qingdao, China', '青島、中国', '青岛, 中国'],
  'Kagoshima, JP':['가고시마, 일본', 'Kagoshima, Japan', '鹿児島、日本', '鹿儿岛, 日本'],
  'Kagosima, JP': ['가고시마, 일본', 'Kagoshima, Japan', '鹿児島、日本', '鹿儿岛, 日本'],
  'Keelung, TW':  ['지룽, 대만', 'Keelung, Taiwan', '基隆、台湾', '基隆, 台湾'],
  'Hong Kong, HK':['홍콩', 'Hong Kong', '香港', '香港'],
  'Sasebo, JP':   ['사세보, 일본', 'Sasebo, Japan', '佐世保、日本', '佐世保, 日本'],
  'Hakata, JP':   ['하카타, 일본', 'Hakata, Japan', '博多、日本', '博多, 日本'],
  'Fukuoka, JP':  ['후쿠오카, 일본', 'Fukuoka, Japan', '福岡、日本', '福冈, 日本'],
  'Yeosu, KR':    ['여수, 대한민국', 'Yeosu, Korea', '麗水、韓国', '丽水, 韩国'],
  'Kobe, JP':     ['고베, 일본', 'Kobe, Japan', '神戸、日本', '神户, 日本'],
  'Kanazawa, JP': ['가나자와, 일본', 'Kanazawa, Japan', '金沢、日本', '金泽, 日本'],
  'Shimonoseki, JP':['시모노세키, 일본', 'Shimonoseki, Japan', '下関、日本', '下关, 日本'],
  'Manila, PH':   ['마닐라, 필리핀', 'Manila, Philippines', 'マニラ、フィリピン', '马尼拉, 菲律宾'],
  'Matsuyama, JP':['마쓰야마, 일본', 'Matsuyama, Japan', '松山、日本', '松山, 日本'],
  'Ulsan, KR':    ['울산, 대한민국', 'Ulsan, Korea', '蔚山、韓国', '蔚山, 韩国'],
  'Kochi, JP':    ['고치, 일본', 'Kochi, Japan', '高知、日本', '高知, 日本'],
  'Kyoto, JP':    ['교토, 일본', 'Kyoto, Japan', '京都、日本', '京都, 日本'],
  'Otaru, JP':    ['오타루, 일본', 'Otaru, Japan', '小樽、日本', '小樽, 日本'],
  'Shimizu, JP':  ['시미즈, 일본', 'Shimizu, Japan', '清水、日本', '清水, 日本'],
};
const i18nPort = raw => {
  const v = PORT_I18N[String(raw || '').trim()];
  return v ? { ko: v[0], en: v[1], ja: v[2], zh: v[3] }
           : { ko: raw || '', en: raw || '', ja: raw || '', zh: raw || '' };
};

/* ---------- 변환 ---------- */
// 엑셀 일련번호 → 날짜(시각은 시트에 적힌 현지시각 그대로)
const serial = v => {
  const n = Number(v);
  if (!isFinite(n)) return null;
  return new Date(Math.round((n - 25569) * 86400 * 1000));
};
const p2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
const hm  = d => `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) {
  console.error('사용법: node scripts/07-build-cruises.js "<선석배정 xlsx 경로>"');
  process.exit(1);
}
const files = unzip(SRC);

// 워크북에서 시트 이름 → 파일 매핑
const wb = files['xl/workbook.xml'].toString('utf8');
const rels = files['xl/_rels/workbook.xml.rels'].toString('utf8');
const relMap = {};
for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2];
const sheetMap = {};
for (const m of wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
  sheetMap[m[1]] = 'xl/' + relMap[m[2]].replace(/^\/?xl\//, '');
}

const TARGETS = [
  { match: /제주항/,   port: 'jeju' },
  { match: /서귀포/,   port: 'gangjeong' },
];

const out = [];
for (const [name, file] of Object.entries(sheetMap)) {
  const target = TARGETS.find(t => t.match.test(name));
  if (!target) continue;
  const rows = sheetRows(files, file);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[2]) continue;
    const arr = serial(r[3]), dep = serial(r[4]);
    if (!arr || !dep) continue;

    const arrM = arr.getUTCHours() * 60 + arr.getUTCMinutes();
    // 자정을 넘겨 출항하는 경우(오버나이트)까지 분 단위로 이어붙임
    const depM = arrM + Math.round((dep - arr) / 60000);

    out.push({
      id: `${target.port}-${ymd(arr)}-${String(r[2]).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      ship: String(r[2]).trim(),
      portKey: target.port,
      berth: String(r[1] || '').trim(),
      date: ymd(arr),
      arrival: hm(arr),
      departure: hm(dep),
      arrM, depM,
      stayHours: Number(r[5]) || Math.round((depM - arrM) / 60),
      overnight: depM > 1440,
      grossTonnage: Number(r[6]) || null,
      passengers: Number(r[7]) || null,
      originPort: i18nPort(r[8]),
      prevPort: i18nPort(r[9]),
      nextPort: i18nPort(r[10]),
      note: String(r[11] || '').trim(),
    });
  }
}
out.sort((a, b) => (a.date + a.arrival).localeCompare(b.date + b.arrival));

const OUT = path.join(__dirname, '..', 'data', 'cruises.json');
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

const byPort = out.reduce((a, c) => (a[c.portKey] = (a[c.portKey] || 0) + 1, a), {});
console.log(`cruises.json 생성 — ${out.length}건`);
console.log(`  제주항 ${byPort.jeju || 0} · 강정항 ${byPort.gangjeong || 0}`);
console.log(`  선박 ${new Set(out.map(c => c.ship)).size}척 · 기간 ${out[0].date} ~ ${out[out.length - 1].date}`);
console.log(`  출처 파일: ${path.basename(SRC)}`);
