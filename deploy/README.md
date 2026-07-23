# 배포 — 단일 GCE VM (web + API + DB 한 인스턴스)

데모를 **하나의 GCE VM**에 올린다: host **nginx** 가 프론트 정적 빌드(`/`)와 API(`/api/` → 백엔드 컨테이너)를 함께 서빙하고, 백엔드와 PostgreSQL 은 `docker compose` 로 같은 VM 에서 돈다.

```
Internet ─▶ nginx :80/:443 (TLS, host)
              ├─ location /       → /var/www/tamrapass  (프론트 SPA 빌드)
              └─ location /api/   → 127.0.0.1:8080      (api 컨테이너)
                                       └─ db 컨테이너 :5432 (compose 내부 네트워크)
```

## 0) 배포 맥락 — 다른 세션/사람이 먼저 읽을 것

- **무엇을 올리나**: 프론트(정적 SPA)·백엔드 API·PostgreSQL 을 **한 GCE VM** 에. host nginx = `/`(정적 프론트) + `/api/`(백엔드 컨테이너, 루프백 프록시).
- **⚠️ 이 배포 구성은 아직 `deploy/vm` 브랜치에만 있다 (양 레포, 미merge·미push)**:
  - **frontend `deploy/vm`** — `vite.config.ts` 정적 SPA(`spa` 모드) 설정. **이게 있어야 `pnpm build` 가 `dist/client/index.html` 을 낸다**(main 에는 아직 없음 — main 빌드는 SSR fetch 핸들러라 정적 셸이 안 나온다).
  - **backend `deploy/vm`** — 이 런북 · `deploy/nginx/tamrapass.conf` · `docker-compose.prod.yml`.
  - 배포하려면 **두 레포의 `deploy/vm` 을 main 에 merge**(또는 그 브랜치를 체크아웃)한 뒤 진행한다.
- **프론트는 현재 100% mock**(`entities/*/api/mock.ts`, 실 네트워크 호출 0). `/api/` 프록시는 백엔드용으로 준비만 돼 있고 **프론트는 아직 호출하지 않는다** → 데모는 프론트 단독으로 완결. 실 API 연동(mock→`/api`)은 별도 작업.
- **⚠️ 백엔드는 이미 Cloud Run + Cloud SQL 로 live**. 이 단일 VM 구성은 **추가**이며, 승인 전까지 live Cloud Run 은 건드리지 않는다.
- **CI/CD 없음(의도)**: MVP 해커톤이라 아래 수동 절차로 충분. 재배포도 수동(맨 아래 §재배포).

### 사람이 미리 준비할 입력값
| 값 | 용도 | 비고 |
|---|---|---|
| GCE VM (Ubuntu LTS, e2-small+) | 실행 호스트 | 방화벽 **22/80/443 만** |
| `VITE_GOOGLE_MAPS_API_KEY` | **프론트 빌드 시** 클라이언트 번들에 baked-in | Google 콘솔: Maps JavaScript + Directions API 활성화, **HTTP 리퍼러 제한에 `<VM_IP>.sslip.io` 추가**(안 하면 지도 안 뜸) |
| `DB_PASSWORD` | postgres 컨테이너 | VM `/opt/tamrapass/.env`(mode 600) |
| VM 공인 IP | sslip.io TLS 호스트명 | `<VM_IP>.sslip.io` (도메인 대체) |

## 1) VM 준비 (1회)
- GCE 인스턴스: Ubuntu LTS, e2-small 이상. **방화벽은 22/80/443 만** 개방.
- 설치:
  ```bash
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
  sudo usermod -aG docker $USER   # 재로그인 후 docker 무권한 사용
  ```

## 2) 앱(API + DB) 배포
```bash
git clone https://github.com/asia-cruise-hack-2026/backend.git /opt/tamrapass
cd /opt/tamrapass
cp .env.example .env            # DB_HOST=db, DB_PASSWORD=<강력한값>, 맵키 입력
chmod 600 .env
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm api npm run seed   # 최초 1회(스키마 DROP·재생성)
curl -s http://127.0.0.1:8080/api/v1/health    # {"ok":true,"spots":...,"goods":...}
```

## 3) 프론트 빌드 배치
프론트는 **정적 SPA**(TanStack Start `spa` 모드 — 프론트 레포 `vite.config.ts`)로 빌드된다. 산출물 `dist/client/`(SPA 셸 `index.html` + 자산)를 `/var/www/tamrapass` 로 복사:
```bash
# (frontend 레포) VITE_GOOGLE_MAPS_API_KEY=<맵키> pnpm build   → dist/client/ (index.html 포함)
sudo mkdir -p /var/www/tamrapass
sudo rsync -a --delete <frontend>/dist/client/ /var/www/tamrapass/
```
> ⚠️ 맵 키는 빌드 시 클라이언트 번들에 baked-in 된다 — 빌드 환경에 `VITE_GOOGLE_MAPS_API_KEY` 를 넣고 빌드할 것. 프론트는 **서버 런타임/컨테이너가 없다**(nginx 정적 서빙만).

## 4) nginx + TLS (도메인 없음 → sslip.io 무료 TLS)
```bash
sudo cp deploy/nginx/tamrapass.conf /etc/nginx/sites-available/tamrapass
sudo ln -sf /etc/nginx/sites-available/tamrapass /etc/nginx/sites-enabled/tamrapass
# server_name 을 VM 공인 IP 기반 sslip.io 호스트명으로 교체 (예: IP 34.64.1.2 → 34.64.1.2.sslip.io):
sudo sed -i 's/server_name _;/server_name <VM_IP>.sslip.io;/' /etc/nginx/sites-available/tamrapass
sudo nginx -t && sudo systemctl reload nginx
# 무료 TLS 발급 — sslip.io 호스트명을 도메인처럼 사용:
sudo certbot --nginx -d <VM_IP>.sslip.io
```
> `sslip.io` 는 `<IP>.sslip.io` 를 그 IP 로 해석해 주는 무료 와일드카드 DNS — 도메인 없이 Let's Encrypt TLS 를 받기 위한 것. **같은 호스트명을 맵 키 리퍼러 제한에도 등록**해야 지도가 뜬다. 접속 URL = `https://<VM_IP>.sslip.io`.

## 재배포
```bash
cd /opt/tamrapass && git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```
> ⚠️ 시드(`npm run seed`)는 **테이블을 DROP·재생성**한다 — 주문·이벤트 기록까지 삭제된다. 운영/데모 중엔 실행하지 말 것.

## 메모
- 컨테이너 API 포트는 **루프백(127.0.0.1:8080)** 에만 바인딩 — 외부 노출은 nginx 만 통한다.
- 시크릿(`.env`)은 이미지·git 에 넣지 않는다. VM 에만 mode 600.
- CI 자동배포(이미지 빌드 → Artifact Registry → SSH)는 필요해지면 추가. MVP 는 위 수동 절차로 충분.
- 이 구성은 기존 `Dockerfile`(Cloud Run 용) 을 그대로 재사용한다 — 컨테이너는 두 환경에서 동일하게 동작한다.
