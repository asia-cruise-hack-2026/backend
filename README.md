# TAMRA PASS — Backend

제주 크루즈 **기항관광** 서비스의 API 서버 + 데이터셋.
크루즈가 제주항·강정항에 정박한 **제한된 시간 안에 다녀올 수 있는 곳**만 골라 지도에 띄우고, 동선을 짜고, 배에 들고 탈 수 있는 상품만 사게 하는 것이 이 서버가 하는 일입니다.

Asia Cruise Liners Hackathon 2026 · [frontend 저장소](https://github.com/asia-cruise-hack-2026/frontend)

---

## 배포

**운영 URL — https://tamrapass-34273089941.asia-northeast3.run.app**

```
[Cloud Run]  tamrapass         서울(asia-northeast3) · 컨테이너
     ↓ 유닉스 소켓 (인터넷 경유 없음)
[Cloud SQL]  omong             PostgreSQL 18 · DB: tamrapass
```

| | |
|---|---|
| 프로젝트 | `gaia-492707` |
| 인스턴스 연결 이름 | `gaia-492707:asia-northeast3:omong` |
| 재배포 | `gcloud run deploy tamrapass --source=. --region=asia-northeast3` |

Cloud Run은 `INSTANCE_CONNECTION_NAME` 이 있으면 유닉스 소켓으로,
없으면 `DB_HOST`/`DB_PORT` 로 접속합니다 (로컬 개발). → `src/db.js`

## 빠른 시작

```bash
cp .env.example .env      # DB 접속 정보와 구글맵 키 입력
npm install               # pg 드라이버
npm run seed              # data/*.json → Cloud SQL  (약 2초)
npm start                 # http://localhost:8787
```

**Node 24 이상**이 필요합니다 (`node --version`).

동작 확인:
```bash
curl http://localhost:8787/api/v1/health
# {"ok":true,"spots":1668,"goods":1895}
```

브라우저에서 `http://localhost:8787` 을 열면 데모 UI가 뜹니다 (`public/`).

---

> ⚠️ **`npm run seed` 는 테이블을 DROP 후 재생성합니다.**
> 관광지·상품 데이터뿐 아니라 **주문·이벤트 기록도 전부 삭제**되므로,
> 운영/데모 중에는 실행하지 마세요.

## 폴더 구조

```
backend/
├── src/
│   ├── server.js        API 서버 (라우팅·비즈니스 로직 전체)
│   ├── db.js            Cloud SQL 접속 (소켓/TCP 자동 전환)
│   ├── schema.sql       PostgreSQL 스키마
│   └── seed.js          data/*.json → DB 적재
├── Dockerfile           Cloud Run 배포용
├── data/                ★ 모든 데이터가 여기 모여 있습니다
│   ├── spots.json       관광지 1,668곳 × 4개 국어 (6,683행)
│   ├── goods.json       특산품·기념품 1,895개 (반입규정 포함)
│   ├── cruises.json     실제 기항 스케줄 321건
│   ├── csv/             같은 데이터의 CSV 버전 (엑셀용)
│   ├── source/          선석배정 원본 xlsx
│   └── README.md        출처·스키마·수집 방법
├── scripts/             데이터 수집 파이프라인 (재현용)
├── docs/
│   ├── API-SPEC.md      전체 API 명세
│   └── reports/         데이터 정리 리포트
└── public/              데모 UI (서버가 정적 서빙)
```

---

## API

전체 명세는 **[docs/API-SPEC.md](docs/API-SPEC.md)** 참고. 자주 쓰는 것만:

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/v1/cruises?date=` | **실제 기항 스케줄** — 그 날 입항하는 배 |
| `GET /api/v1/cruises/dates` | 기항 예정일 목록 (날짜 선택 UI용) |
| `GET /api/v1/spots?cruiseId=msc` | **체류시간 안에 다녀올 수 있는 스팟만** 반환 |
| `GET /api/v1/spots/:id/nearby` | 좌표 기반 주변 추천 |
| `POST /api/v1/packages` | 동선 최적화 + 시간표 생성 |
| `GET /api/v1/goods?category=food` | 특산품 (반입규정 4단계 포함) |
| `POST /api/v1/orders` | 주문 — **반입 미동의 시 409** |
| `POST /api/v1/events` | 행동 로그 (데이터 선순환 실증) |

공통 파라미터: `lang=ko|en|ja|zh` — 콘텐츠까지 해당 언어로 반환됩니다.

### 이 서버의 핵심 계산

```
availableMinutes = 정박시간 − 90분(CIQ·승하선 버퍼)
roundTripMinutes = 이동시간 × 2 + 스팟 체류시간
fitsWindow       = roundTripMinutes ≤ availableMinutes
```

"3시간 안에 갈 수 있는가"가 이 서비스의 존재 이유이므로, 프론트 필터가 아니라 **서버가 책임집니다.**
현재 이동시간은 직선거리 기반 추정(`max(6, km × 2.4)`)이며, Google Distance Matrix API로 교체하면 실주행 시간이 됩니다.

---

## 데이터

| 데이터 | 규모 | 출처 |
|---|--:|---|
| **크루즈 기항** | **321건 / 30척** | **제주도 해양산업과 선석배정 자료** |
| 관광지·맛집 | 1,668곳 × 4개 국어 | 비짓제주 공개 API 1,398 + 탐나오 270 |
| 특산품·기념품 | 1,895개 | 탐나오 |
| 좌표 보유 | 1,620곳 | 지도 매핑 가능 |
| 썸네일 보유 | 1,655곳 | 양 소스 CDN |

자세한 스키마와 수집 방법은 **[data/README.md](data/README.md)** 참고.

> ⚠️ **반입규정(`importStatus`)은 공식 데이터가 아닙니다.**
> 육류→불가, 생과일·수산물→제한, 주류→조건부 같은 상식 기반 **자체 규칙 엔진**의 판정입니다.
> 실제 규정은 목적지 국가·선사마다 다르므로, 운영 단계에서는 관세청·선사 데이터 연동이 필요합니다.
> 규칙은 `scripts/06-build-goods.js` 한 곳에서만 관리합니다.

---

## 의도적으로 만들지 않은 것

데모에 불필요해서 범위에서 뺐습니다. 필요해지면 추가하면 됩니다.

- 회원가입·로그인 (세션은 `X-Session-Id` 헤더로만 구분)
- **API 인증** — 현재 CORS `*` · 인증 없음. URL만 알면 누구나 호출 가능합니다.
  데모 범위에서는 의도적 선택이며, 데이터 수정 API를 추가한다면 인증이 반드시 필요합니다.
- 실제 PG 결제 (주문은 `status: "paid"`로 즉시 완료)
- 관리자 화면
