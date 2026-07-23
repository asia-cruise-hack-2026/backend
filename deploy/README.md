# 배포 — 단일 GCE VM (web + API + DB 한 인스턴스)

데모를 **하나의 GCE VM**에 올린다: host **nginx** 가 프론트 정적 빌드(`/`)와 API(`/api/` → 백엔드 컨테이너)를 함께 서빙하고, 백엔드와 PostgreSQL 은 `docker compose` 로 같은 VM 에서 돈다.

```
Internet ─▶ nginx :80/:443 (TLS, host)
              ├─ location /       → /var/www/tamrapass  (프론트 SPA 빌드)
              └─ location /api/   → 127.0.0.1:8080      (api 컨테이너)
                                       └─ db 컨테이너 :5432 (compose 내부 네트워크)
```

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

## 4) nginx + TLS
```bash
sudo cp deploy/nginx/tamrapass.conf /etc/nginx/sites-available/tamrapass
sudo ln -sf /etc/nginx/sites-available/tamrapass /etc/nginx/sites-enabled/tamrapass
sudo nginx -t && sudo systemctl reload nginx
# 도메인이 있으면 (server_name 을 도메인으로 바꾼 뒤):
sudo certbot --nginx -d <도메인>
```

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
