# DDNet Required Login (Cloudflare Pages + D1)

This project provides:

- Web signup/login
- Taiwan-first signup policy (`CF-IPCountry == TW`)
- Invite code flow for non-Taiwan signups
- Permanent game login code per account (valid until rotated)
- Game-server verification API for DDNet `/login CODE`

## 1) Cloudflare setup

1. Create a D1 database in Cloudflare dashboard.
2. Put the D1 ID into `wrangler.toml` (`database_id` and `preview_database_id`).
3. Install dependencies:

```bash
npm install
```

4. Apply migrations:

```bash
npm run d1:migrate
```

5. Set production variables in Pages project:

- `SESSION_SECRET`
- `CODE_PEPPER`
- `GAME_SERVER_API_KEY`
- `INVITE_DEFAULT_QUOTA` (example: `1`)
- `BLOCK_VPN_PROXY` (optional: `1` to block likely VPN/proxy/datacenter signups)

6. Deploy:

```bash
npm run deploy
```

## 2) Local dev

1. Copy `.dev.vars.example` to `.dev.vars` and fill secrets.
2. Run local migration:

```bash
npm run d1:migrate:local
```

3. Start Vite frontend:

```bash
npm run dev
```

4. Build output for Pages:

```bash
npm run build
```

## 3) API contract for DDNet server

Game server verifies code with:

- `POST /api/game/verify`
- Header: `X-Game-Server-Key: <GAME_SERVER_API_KEY>`
- Header: `X-Game-Login-Code: <USER_CODE>`

Response examples:

```json
{ "ok": true, "accountId": 7, "username": "player01" }
```

```json
{ "ok": false, "message": "Code not found" }
```

## 4) Frontend routes

- `/` : main menu
- `/login` : login page
- `/register` : signup page
- `/dashboard` : account dashboard (invite code + rotate game login code)

## 5) DDNet server config example

Set these in your DDNet server config after C++ patch is applied:

```cfg
sv_web_login_required 1
sv_web_login_api_url "https://your-domain.pages.dev"
sv_web_login_api_key "same-value-as-GAME_SERVER_API_KEY"
sv_web_login_domain_hint "your-domain.pages.dev"
sv_web_login_notice_interval 8
sv_web_login_try_delay 2
```

Behavior:

- Unauthenticated players are forced to spectator.
- They see login guidance broadcast.
- `/login CODE` triggers `/api/game/verify`.
- Success unlocks gameplay.
