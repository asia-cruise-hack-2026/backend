# 데이터 수집 파이프라인

`data/` 의 JSON을 처음부터 다시 만드는 스크립트입니다.
**평상시에는 실행할 필요가 없습니다** — 결과물이 이미 `data/` 에 커밋돼 있습니다.
데이터를 갱신하거나 수집 방법을 검증할 때만 쓰세요.

> 이 스크립트들은 수집 당시 한 번씩 실행된 것으로, 중간 산출물을 스크립트와 같은 폴더에 만듭니다.
> 실행 전에 경로와 출력 위치를 확인하세요.

## 준비물

- Node 22.5+ (`node:sqlite` 사용)
- bash + curl (Windows는 Git Bash)
- `.env` 의 `VISITJEJU_API_KEY`

## 실행 순서

| # | 스크립트 | 하는 일 | 소요 |
|--:|---|---|---|
| 01 | `01-scrape-tamnao-spots.sh` | 탐나오 관광지·맛집 270곳 상세페이지에서 이름·좌표·가격 추출 | ~3분 |
| — | `lib-tamnao-thumb.sh` | 위 270곳의 썸네일(og:image) 수집 | ~2분 |
| 02 | `02-reverse-geocode.sh` | 좌표 → 실주소 역지오코딩 + 항구별 거리 계산 | ~15분 |
| 03 | `03-build-visitjeju-i18n.js` | 비짓제주 4개 국어 수집·병합 | ~1분 |
| 04 | `04-build-spots.js` | 두 소스 통합 → **`data/spots.json`** | 즉시 |
| 05 | `05-scrape-tamnao-goods.sh` | 특산품 1,895개 목록 수집 (13개 카테고리 × 페이지) | ~4분 |
| 06 | `06-build-goods.js` | 파싱 + 반입규정 판정 → **`data/goods.json`** | 즉시 |

02번이 가장 오래 걸립니다. OSM Nominatim은 **초당 1회** 제한이 있어 의도적으로 1.1초씩 쉽니다.
이 제한을 지키지 않으면 차단당하니 병렬화하지 마세요.

## 알아둘 것

**탐나오 목록 API** — `POST /web/sp/productList.ajax` (관광지), `POST /web/sv/productList.ajax` (특산품).
`sTabCtgr` 를 **비워야** 전체가 나옵니다. 값을 넣으면 서브탭 기본값인 8개만 반환됩니다.

**비짓제주 필터** — 파라미터명이 `cate1cd` 입니다. `category` 로 보내면 **무시되고 전체 5,836건**이 나오니 주의.

**반입규정 수정** — `06-build-goods.js` 상단의 정규식 테이블(`MEAT`/`ALCOHOL`/`PRODUCE`/`PROCESSED` 등)만 고치면 됩니다. 판정 로직은 그 아래 한 곳에 모여 있습니다.
