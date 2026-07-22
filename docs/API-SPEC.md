# TAMRA PASS — API 명세서 v1

> 설계 원본: `크루즈 승선객 제주 서비스 앱.dc.html` (Vue/DCLogic 프로토타입)
> 목적: 프로토타입의 **하드코딩 상수**(`CRUISES` / `SPOTS` / `PRODUCTS` / `PARTNERS`)를 API로 대체
> 스택: 경량 API + SQLite · 프론트 Vite
> 작성일: 2026-07-22

---

## 0. 한 장 요약 — 설계 상수 → 엔드포인트

프론트는 아래 매핑만 보면 됩니다. **응답 필드명을 설계 상수와 최대한 일치**시켜 화면 코드 수정을 최소화했습니다.

| 설계 상수 | 화면 | 대체 엔드포인트 | 데이터 출처 |
|---|---|---|---|
| `CRUISES` (5) | 크루즈 선택 | `GET /cruises` | 자체 시드 (실제 기항 스케줄) |
| `PORTS` | 전역 | `GET /ports` | 자체 시드 |
| `SPOTS` (8, x/y 가짜좌표) | 탐방·지도 | `GET /spots` | **비짓제주 1,398 + 탐나오 270** |
| `SPOTS[].subs` | 스팟 상세 | `GET /spots/{id}/nearby` | 좌표 기반 실시간 계산 |
| (없음) | AI 패키지 | `POST /packages` | 서버 계산 |
| `PARTNERS` (3) | 매칭 | `GET /partners` | 자체 시드 |
| `PRODUCTS` (8) | 쇼핑 | `GET /goods` | **탐나오 특산품 1,895** |
| `TAXI_DRIVER` | 이동 | `POST /taxi/requests` | 자체 시드 |
| `STR` (4개국어 UI 문구) | 전역 | **프론트에 유지** | 설계 원본 그대로 |

> `STR`은 UI 라벨이라 API로 뺄 이유가 없습니다. **콘텐츠(스팟·상품)만** 다국어를 API가 책임집니다.

---

## 1. 공통 규약

**Base URL** `/api/v1`
**인증** 해커톤 범위에서는 없음. 세션은 `X-Session-Id` 헤더(UUID, 최초 진입 시 프론트 생성)로만 구분 — 장바구니·주문·행동로그를 묶는 용도.

**언어** 모든 콘텐츠 응답은 `?lang=` 로 제어. 값: `ko` | `en` | `ja` | `zh` (설계와 동일).
미지정 시 `ko`. 해당 언어 데이터가 없으면 `ko`로 폴백하고 `"langFallback": true`를 붙입니다.

**공통 에러**
```json
{ "error": { "code": "IMPORT_NOT_AGREED", "message": "반입 규정 동의가 필요합니다." } }
```

| 코드 | HTTP | 의미 |
|---|--:|---|
| `NOT_FOUND` | 404 | 리소스 없음 |
| `INVALID_PARAM` | 400 | 파라미터 오류 |
| `IMPORT_NOT_AGREED` | 409 | 반입 규정 미동의 상태로 결제 시도 |
| `WINDOW_EXCEEDED` | 409 | 패키지가 체류 시간 초과 |

**페이지네이션** `?page=1&size=20` → 응답에 `{ items, page, size, totalCount }`

---

## 2. 온보딩

### `GET /cruises`
크루즈 선택 화면. 설계 `CRUISES` 대체.

```json
{ "items": [
  { "id": "msc", "line": "MSC Cruises", "ship": "MSC Bellissima",
    "port": { "key": "jeju", "name": "제주항", "lat": 33.5230, "lng": 126.5370 },
    "arrival": "08:00", "departure": "18:00",
    "stayMinutes": 600, "boardByTime": "17:30",
    "nextDestination": "후쿠오카, 일본" } ] }
```

- `boardByTime` = 출항 30분 전 (설계 로직 동일)
- `stayMinutes`는 **총 정박시간**. 실제 관광 가용시간은 `/spots` 가 별도 계산 (§3)

### `GET /ports`
```json
{ "items": [ { "key": "jeju", "name": "제주항", "lat": 33.5230, "lng": 126.5370 } ] }
```

---

## 3. 탐방 — 지도 & 스팟 ★핵심

### `GET /spots`
**지도에 찍을 핀 목록.** 설계의 `x%/y%` 가짜 좌표를 **실제 `lat/lng`** 로 대체합니다.

| 파라미터 | 예시 | 설명 |
|---|---|---|
| `cruiseId` | `msc` | 주면 항구·체류시간을 자동 적용 (권장) |
| `port` | `jeju` \| `gangjeong` | `cruiseId` 없이 직접 지정 |
| `maxMinutes` | `180` | **왕복 이동 + 체류가 이 시간 안에 드는 스팟만** |
| `category` | `nature` | 생략 시 전체 |
| `source` | `visitjeju` \| `tamnao` | 생략 시 전체 |
| `bookableOnly` | `true` | 탐나오 예약 가능 상품만 |
| `bbox` | `33.4,126.4,33.6,126.7` | 지도 이동 시 화면 영역만 |
| `lang` `page` `size` | | |

```json
{ "items": [
  { "id": "vj_CNTS_300000000013941",
    "source": "visitjeju",
    "name": "성산일출봉",
    "category": { "key": "nature", "label": "자연경관" },
    "lat": 33.4580, "lng": 126.9427,
    "address": "제주특별자치도 서귀포시 성산읍 일출로 284-12",
    "thumbnail": "https://api.cdn.visitjeju.net/photomng/thumbnailpath/....webp",
    "distanceKm": 37.6,
    "driveMinutes": 52,
    "stayMinutes": 60,
    "roundTripMinutes": 164,
    "fitsWindow": true,
    "bookable": false,
    "detailUrl": "https://visitjeju.net/kr/detail/view?contentsid=CNTS_..." } ],
  "page": 1, "size": 20, "totalCount": 412,
  "window": { "port": "jeju", "availableMinutes": 180 } }
```

**`fitsWindow` 계산식** — 이 앱의 존재 이유이므로 서버가 책임집니다.
```
availableMinutes = stayMinutes - CIQ/버퍼(90분 기본)
roundTripMinutes = driveMinutes × 2 + stayMinutes(스팟 권장 체류)
fitsWindow       = roundTripMinutes ≤ availableMinutes
```
- `driveMinutes` 1단계: 직선거리 기반 추정 `max(6, round(km × 2.4))` (설계의 택시 로직과 동일)
- `driveMinutes` 2단계: **Google Distance Matrix API**로 실주행 시간 대체 (프론트 JS SDK 호출 → 결과를 `PATCH /spots/traveltime`로 캐시)

### `GET /spots/{id}`
스팟 상세. 설계 `curSpot` 대체.
```json
{ "id": "vj_CNTS_...", "name": "성산일출봉", "category": {...},
  "description": "유네스코 세계자연유산으로 지정된 화산 분화구",
  "lat": 33.4580, "lng": 126.9427, "address": "...", "phone": "064-783-0959",
  "images": ["https://api.cdn.visitjeju.net/..."],
  "tags": ["세계자연유산", "일출", "포토스팟"],
  "distanceKm": 37.6, "driveMinutes": 52, "stayMinutes": 60,
  "bookable": false, "detailUrl": "..." }
```

### `GET /spots/{id}/nearby?radius=3&limit=4`
설계의 `subs`(주변 추천) 대체. **하드코딩이 아니라 좌표 기반 실시간 계산.**
```json
{ "items": [
  { "id": "tn_SP00002523", "name": "아쿠아플라넷 제주", "type": "관광지",
    "distanceKm": 1.2, "walkMinutes": 15, "thumbnail": "...", "bookable": true } ] }
```

### `GET /spots/categories?lang=ko`
필터 칩용. `{ "items": [{"key":"nature","label":"자연경관","count":312}] }`

---

## 4. AI 패키지

### `POST /packages`
설계의 4단계 애니메이션이 도는 동안 호출. 응답 자체는 즉시.

```json
// 요청
{ "cruiseId": "msc", "spotIds": ["vj_CNTS_...", "tn_SP00002523"], "lang": "ko" }
```
```json
// 응답
{ "id": "pkg_a1b2c3",
  "totalMinutes": 245,
  "availableMinutes": 510,
  "fitsWindow": true,
  "itinerary": [
    { "no": 1, "spotId": "...", "name": "동문시장", "category": "전통시장",
      "arriveAt": "09:30", "departAt": "10:30", "stayMinutes": 60,
      "lat": 33.5115, "lng": 126.5271,
      "moveToNext": { "minutes": 20, "distanceKm": 3.5, "mode": "car" } } ],
  "returnToPort": { "arriveAt": "16:45", "bufferMinutes": 45 },
  "polyline": "encoded_polyline_for_map" }
```

**동선 최적화**: 스팟 수가 적으므로(≤6) 완전탐색 TSP로 충분. 항구 출발 → 스팟 순회 → 항구 복귀 총시간 최소화.
**`WINDOW_EXCEEDED`**: 초과 시 409 + `suggestion: { removeSpotIds: [...] }` 로 무엇을 빼면 되는지 제안.

### `GET /packages/{id}` — 저장된 패키지 조회

---

## 5. 파트너 매칭

### `GET /partners?packageId=pkg_a1b2c3&lang=ko`
설계 `PARTNERS` 대체.
```json
{ "items": [
  { "id": "van", "name": "김성호", "role": "미니밴 기사", "vehicle": "카니발 9인승",
    "rating": 4.9, "reviewCount": 128, "languages": ["ko","en"],
    "verified": true, "price": 120000, "priceLabel": "120,000원 ~",
    "estimatedPrice": 135000 } ] }
```

### `POST /bookings`
```json
{ "packageId": "pkg_a1b2c3", "partnerId": "van" }
→ { "id": "bk_...", "status": "requested", "partner": {...} }
```

---

## 6. 쇼핑 ★반입규정 게이트

### `GET /goods`
설계 `PRODUCTS` 대체. 데이터: **탐나오 특산품 1,895개.**

| 파라미터 | 값 |
|---|---|
| `category` | `all`(기본) \| `food` \| `cosmetics` \| `alcohol` \| `souvenir` |
| `importStatus` | `allowed` \| `conditional` \| `restricted` \| `prohibited` |
| `sort` | `popular`(기본) \| `priceAsc` \| `priceDesc` |
| `lang` `page` `size` | |

```json
{ "items": [
  { "id": "SV00002777", "name": "제주 감귤 초콜릿",
    "description": "제주 감귤로 만든 수제 초콜릿",
    "category": "food", "categoryLabel": "간식/유제품",
    "price": 12000, "priceLabel": "12,000원",
    "thumbnail": "https://www.tamnao.com/data/sv/thumb/SV00002777_1.jpg",
    "importStatus": "allowed",
    "importLabel": "반입 가능",
    "customsNote": "포장·가공 식품 — 반입 제한이 없어요.",
    "cruiseLineNote": "선사 반입 제한이 없습니다.",
    "detailUrl": "https://www.tamnao.com/web/sv/detailPrdt.do?prdtNum=SV00002777" } ],
  "totalCount": 1087 }
```

**`importStatus` 4단계** (설계의 색/아이콘과 1:1)

| 값 | 라벨 | 색 | 현재 분류 수 |
|---|---|---|--:|
| `allowed` | 반입 가능 | `#12A150` | 1,364 |
| `conditional` | 조건부 반입 | `#C08A00` | 4 |
| `restricted` | 반입 제한 | `#C7690A` | 423 |
| `prohibited` | 반입 불가 | `#E23B3B` | 104 |

> ⚠️ **이 값은 공식 규정이 아니라 자체 규칙 엔진의 판정입니다.**
> 육류·축산물→불가, 생과일·수산물→제한, 주류→조건부, 가공·포장식품/화장품/공예품→가능.
> 실제 규정은 **목적지 국가·선사마다 다르므로**, 운영 단계에서는 관세청·선사 데이터 연동이 필요합니다.
> 앱 화면에 이 취지의 고지 문구를 반드시 노출하세요. 규칙은 `rules/import_rules.js` 한 곳에서만 관리합니다.

### `GET /goods/{id}` — 상세 (이미지 여러 장 + 규정 전문)

### 장바구니
```
GET    /cart                  → { items:[...], totalPrice, hasRestrictedItems }
POST   /cart/items            { goodsId, qty }
DELETE /cart/items/{goodsId}
```
`hasRestrictedItems`: 담긴 상품 중 `restricted`/`prohibited`가 있으면 `true` → 결제 화면 경고 박스 노출 트리거.

### `POST /orders` ★동의 게이트
```json
// 요청
{ "items": [{ "goodsId": "SV00002777", "qty": 1 }],
  "deliveryMethod": "ship",          // ship | port_pickup | current_location
  "importAgreed": true }
```
- **`importAgreed`가 `false`면 `409 IMPORT_NOT_AGREED`** — 설계의 "동의 없이 결제 버튼 비활성"을 서버에서도 강제합니다. (프론트만 막으면 심사에서 지적당합니다)
- 응답에 `restrictedItems[]`를 포함해 무엇 때문에 동의가 필요한지 명시.

```json
{ "id": "ord_...", "status": "paid", "totalPrice": 37000,
  "deliveryMethod": "ship",
  "deliveryNote": "출항 전까지 크루즈 선박으로 배송해 드릴게요.",
  "restrictedItems": [ { "goodsId": "...", "name": "한라봉", "importStatus": "restricted" } ] }
```

---

## 7. 이동 (택시)

```
GET  /taxi/estimate?port=jeju&spotId=vj_CNTS_...
→ { "distanceKm": 3.5, "durationMinutes": 12, "fare": 10300, "fareLabel": "10,300원" }

POST /taxi/requests   { "port": "jeju", "spotId": "..." }
→ { "id":"tx_...", "status":"assigned", "etaMinutes":6,
    "driver": { "name":"박준영","vehicle":"쏘나타","plate":"제주 80바 3517","rating":4.9 } }
```
요금식(설계 동일): `4,300 + round(km) × 1,700`

---

## 8. 행동 로그 ★심사 포인트

박운정 교수 특강의 **"서비스제공 → 데이터수집 → 분석 → 환류"** 선순환에서 *데이터수집* 단계를 실증하는 엔드포인트입니다. 넣어두면 발표에서 "우리는 데이터를 실제로 쌓는다"고 말할 수 있습니다.

```
POST /events
{ "type": "spot_view", "spotId": "...", "lang": "ko", "cruiseId": "msc" }
```
`type`: `spot_view` · `spot_add_package` · `package_created` · `goods_view` · `order_placed` · `taxi_called`

```
GET /stats/summary   (관리자/발표용)
→ { "topSpots":[...], "topGoods":[...], "avgPackageMinutes":218,
    "langDistribution": {"ko":12,"en":48,"zh":31,"ja":9},
    "portDistribution": {"jeju":63,"gangjeong":37} }
```

---

## 9. 데이터베이스 (SQLite)

```sql
-- 콘텐츠 (다국어: 언어별 행)
CREATE TABLE spots (
  id TEXT, lang TEXT,                    -- 'vj_CNTS_...' | 'tn_SP...'
  source TEXT,                           -- visitjeju | tamnao
  name TEXT, description TEXT, category TEXT, category_label TEXT,
  lat REAL, lng REAL, address TEXT, phone TEXT,
  thumbnail TEXT, tags TEXT, detail_url TEXT,
  bookable INTEGER DEFAULT 0, price INTEGER,
  dist_jeju_km REAL, dist_gangjeong_km REAL,
  stay_minutes INTEGER DEFAULT 60,
  PRIMARY KEY (id, lang)
);
CREATE INDEX idx_spots_geo  ON spots(lat, lng);
CREATE INDEX idx_spots_dist ON spots(dist_jeju_km, dist_gangjeong_km);

CREATE TABLE goods (
  id TEXT PRIMARY KEY,                   -- 'SV00002777'
  name TEXT, description TEXT,
  category TEXT, category_label TEXT,
  price INTEGER, thumbnail TEXT, detail_url TEXT,
  import_status TEXT, customs_note TEXT, cruise_line_note TEXT
);

CREATE TABLE cruises (
  id TEXT PRIMARY KEY, line TEXT, ship TEXT, port_key TEXT,
  arrival TEXT, departure TEXT, stay_minutes INTEGER, next_destination TEXT
);
CREATE TABLE partners (
  id TEXT PRIMARY KEY, name TEXT, role TEXT, vehicle TEXT,
  rating REAL, languages TEXT, verified INTEGER, price INTEGER
);

-- 세션 데이터
CREATE TABLE packages (
  id TEXT PRIMARY KEY, session_id TEXT, cruise_id TEXT,
  spot_ids TEXT, itinerary_json TEXT, total_minutes INTEGER, created_at TEXT
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
```

### 시드 데이터 파이프라인
| 소스 | 산출물 | 상태 |
|---|---|---|
| 비짓제주 API (`locale=kr/en/jp/cn`) | `spots` 1,398 × 4언어 | 한국어 완료 · **다국어 재수집 필요** |
| 탐나오 관광지/맛집 | `spots` 270 (예약가능) | 완료 · **썸네일 필드 추가 필요** |
| 탐나오 특산품 | `goods` 1,895 | ✅ 완료 (썸네일·반입규정 포함) |
| 자체 시드 | `cruises` 5, `partners` 3 | 설계에서 이관 |

> **남은 데이터 작업 2건**
> 1. 비짓제주 4개 국어 재수집 (API가 지원하므로 스크립트 실행만, ~10분)
> 2. 두 스팟 소스에 `thumbnail` 필드 추가 — 비짓제주 `repPhoto.photoid.thumbnailpath`, 탐나오 `og:image`

---

## 10. 구현 우선순위

데모까지 시간이 한정적이므로 **화면이 도는 순서**로 자릅니다.

| 순위 | 범위 | 없으면 안 되는 이유 |
|--:|---|---|
| **P0** | `GET /cruises` · `GET /spots` · `GET /spots/{id}` | 지도가 안 뜸 = 데모 불가 |
| **P0** | `GET /goods` · `GET /goods/{id}` · `POST /orders` | 쇼핑 플로우 = 차별화 포인트 |
| **P1** | `POST /packages` · `GET /spots/{id}/nearby` | AI 패키지 = 발표 하이라이트 |
| **P1** | `POST /events` | 선순환 실증 = 심사 채점표 |
| **P2** | `/partners` · `/bookings` · `/taxi/*` | 시드 데이터로 목업 가능 |
| **P3** | `/cart` · `/stats/summary` | 주문에 통합하면 생략 가능 |

**의도적으로 안 만드는 것**: 회원가입·로그인, 실제 PG 결제, 관리자 화면.
데모에서 필요 없고, 시간을 P0/P1에 씁니다. Q&A에서 물으면 "의도적 스코프 제외"로 답하면 됩니다.
