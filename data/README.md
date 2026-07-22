# 데이터

이 폴더가 **모든 데이터의 단일 출처(single source of truth)** 입니다.
`npm run seed` 가 여기 있는 JSON을 읽어 SQLite(`tamrapass.db`)를 만듭니다. DB는 언제든 지우고 다시 만들어도 됩니다.

| 파일 | 행 수 | 크기 | 설명 |
|---|--:|--:|---|
| `spots.json` | 6,683 | 6.5MB | 관광지 1,668곳 × 4개 국어 |
| `goods.json` | 1,895 | 1.0MB | 특산품·기념품 (반입규정 포함) |
| `cruises.json` | 321 | 0.2MB | **실제 크루즈 기항 스케줄** (2026년 전체) |
| `csv/spots.csv` | 6,683 | 4.4MB | 위와 동일, 엑셀용 (UTF-8 BOM) |
| `csv/goods.csv` | 1,895 | 0.7MB | 위와 동일 |

---

## spots.json

관광지 한 곳이 **언어마다 1행**씩, 즉 `(id, lang)` 조합이 키입니다.
좌표·거리 같은 언어 무관 값은 모든 행에 동일하게 복제돼 있습니다.

```json
{
  "id": "vj_CNTS_300000000013941",
  "lang": "ko",
  "source": "visitjeju",
  "name": "성산일출봉",
  "description": "유네스코 세계자연유산",
  "category": "nature",
  "category_label": "자연·경관",
  "lat": 33.4580, "lng": 126.9427,
  "address": "제주특별자치도 서귀포시 성산읍 일출로 284-12",
  "phone": "064-783-0959",
  "thumbnail": "https://api.cdn.visitjeju.net/...",
  "image": "https://api.cdn.visitjeju.net/...",
  "tags": "세계자연유산,일출,포토스팟",
  "dist_jeju_km": 37.6,
  "dist_gangjeong_km": 47.7,
  "nearest_port": "제주항",
  "bookable": 0,
  "stay_minutes": 60,
  "lang_fallback": 0,
  "detail_url": "https://visitjeju.net/kr/detail/view?contentsid=..."
}
```

**필드 주의사항**

- `id` 접두사로 출처가 갈립니다 — `vj_`(비짓제주) / `tn_`(탐나오)
- `category`(키)는 **언어와 무관하게 동일**합니다. 언어별로 바뀌는 건 `category_label`뿐입니다.
  한국어 원문 기준으로 1회만 분류하기 때문입니다. 필터링은 반드시 `category`로 하세요.
- `bookable: 1` 은 탐나오에서 **예약·결제가 가능한 상품**이라는 뜻입니다 (승마·요트·온천 등).
- `stay_minutes` 는 권장 체류시간. 일반 관광지 60분, 탐나오 체험상품 90분으로 부여했습니다.
- `lang_fallback: 1` 은 해당 언어 원문이 없어 한국어를 그대로 넣었다는 표시입니다.
  일본어 144건, 탐나오 전체가 여기 해당합니다.
- 좌표가 없는 곳이 48곳 있습니다 (`lat: null`). 지도에 못 찍으므로 API가 기본적으로 제외합니다.

**카테고리 7종** — `nature` 자연·경관 / `activity` 체험·액티비티 / `culture` 문화·역사 / `beach` 해변·바다 / `attraction` 관광지 / `food` 맛집·카페 / `wellness` 웰니스

---

## goods.json

```json
{
  "prdtNum": "SV00002777",
  "name": "제주 감귤 초콜릿",
  "desc": "제주 감귤로 만든 수제 초콜릿",
  "price": 12000,
  "tamnao_category": "간식/유제품",
  "shop_category": "food",
  "thumbnail": "https://www.tamnao.com/data/sv/thumb/SV00002777_1.jpg",
  "url": "https://www.tamnao.com/web/sv/detailPrdt.do?prdtNum=SV00002777",
  "import_status": "allowed",
  "customs_note": "포장·가공 식품 — 반입 제한이 없어요.",
  "line_note": "선사 반입 제한이 없습니다."
}
```

**`import_status` 4단계**

| 값 | 라벨 | 개수 | 판정 기준 |
|---|---|--:|---|
| `allowed` | 반입 가능 | 1,364 | 가공·포장식품, 화장품, 공예품 |
| `conditional` | 조건부 반입 | 4 | 주류 (면세 한도·승무원 보관) |
| `restricted` | 반입 제한 | 423 | 생과일·채소, 신선 수산물, 떡·두부 |
| `prohibited` | 반입 불가 | 104 | 육류·축산물·달걀 |

> ⚠️ **공식 규정이 아니라 자체 규칙 엔진의 판정입니다.**
> 실제 반입 가능 여부는 **목적지 국가와 선사마다 다릅니다.**
> 운영 단계에서는 관세청·선사 데이터 연동이 필요하며, 앱 화면에도 이 취지의 고지가 있어야 합니다.
> 규칙을 고치려면 `scripts/06-build-goods.js` 의 정규식 테이블 한 곳만 수정하면 됩니다.

가공품이 신선품으로 잘못 잡히는 걸 막는 예외 처리가 들어가 있습니다 —
감귤 **초콜릿**·바나나 **말랭이칩**은 `allowed`, 생바나나·생오렌지는 `restricted`,
**소주잔**(기념품)은 `allowed`, **무알콜** 뱅쇼는 주류에서 제외.

---

## cruises.json

제주특별자치도 해양산업과가 배포하는 **선석배정 자료**를 그대로 옮긴 것입니다. 목업이 아닙니다.

```json
{
  "id": "jeju-2026-07-24-adora-mediterranea",
  "ship": "Adora Mediterranea",
  "portKey": "jeju",              // jeju | gangjeong
  "berth": "제주항",               // 제주항 | 강정1 | 강정2
  "date": "2026-07-24",
  "arrival": "08:00", "departure": "16:00",
  "arrM": 480, "depM": 960,        // 자정을 넘기면 depM > 1440
  "stayHours": 8, "overnight": false,
  "grossTonnage": 85619, "passengers": 2680,
  "originPort": {...}, "prevPort": {...},
  "nextPort": { "ko": "부산, 대한민국", "en": "Busan, Korea", "ja": "…", "zh": "…" }
}
```

| | |
|---|---|
| 기간 | 2026-01-04 ~ 2026-12-30 |
| 기항 건수 | **321건** (제주항 122 · 강정항 199) |
| 선박 | 30척 |
| 체류시간 | 5.5 ~ 43.5시간 (대부분 8시간 전후) |
| 오버나이트 | 자정을 넘겨 정박하는 일정 존재 (`overnight: true`) |

> **설계 목업과 실제가 달랐던 점** — 초기 프로토타입은 MSC Bellissima·Adora Magic City·Diamond Princess를
> 제주항으로 표시했지만, 실제 선석배정에서 이 세 척은 **모두 강정항**에 접안합니다.
> 항구가 다르면 추천 관광지가 통째로 달라지므로 반드시 실제 데이터를 써야 합니다.

**갱신 방법** — 원본은 수시로 변경됩니다.
[제주도 크루즈선석배정 변경알림](https://www.jeju.go.kr/group/part11/change.htm)에서 최신 xlsx를 받아:

```bash
node scripts/07-build-cruises.js "경로/2026년도 선석배정(알림)-XXXXXX.xlsx"
npm run seed
```

현재 반영본: `data/source/2026년도 선석배정(알림)-260718.xlsx` (2026-07-18 배포)

## 데이터 출처

| 출처 | 라이선스/이용 | 수집 방식 |
|---|---|---|
| [비짓제주](https://visitjeju.net) | 공개 API (apiKey 발급) | `vsjApi/contents/list`, `locale=kr/en/jp/cn` |
| [탐나오](https://www.tamnao.com) | 제주도·제주관광협회 공공 플랫폼 | 목록 AJAX + 상세페이지 파싱 |
| [OSM Nominatim](https://nominatim.openstreetmap.org) | ODbL | 좌표 → 주소 역지오코딩 |
| [제주도 해양산업과](https://www.jeju.go.kr/group/part11/change.htm) | 공공 배포 자료 | 크루즈 선석배정 xlsx |

**탐나오 주소는 쓰지 않았습니다.** 상세페이지의 텍스트 주소 247건이 판매자 템플릿
(`제주시 용담로 121`)이라 실제 위치가 아니었습니다. 대신 페이지에 박혀 있는 카카오맵 좌표
(`daum.maps.LatLng`)를 뽑아 역지오코딩해서 실주소를 복원했습니다.

## 재수집

`scripts/` 의 번호 순서대로 실행하면 이 폴더의 JSON을 다시 만들 수 있습니다.
자세한 절차는 [scripts/README.md](../scripts/README.md) 참고.
