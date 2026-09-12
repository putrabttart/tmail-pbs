# PBS Mail

Aplikasi temporary email berbasis Next.js 14 (App Router) dengan UI publik, dashboard admin, dan Partner API untuk integrasi pihak ketiga.

## Fitur Utama

### User (Publik)
- Generate alias email instan dengan domain pilihan
- Inbox real-time (polling 4 detik + SSE push notification)
- Ekstraksi OTP otomatis dari email masuk (badge + notifikasi)
- Notifikasi suara & browser notification saat OTP terdeteksi
- Copy OTP sekali klik
- 5 tema warna (blue, dark, green, rose, amber)
- Akses alias langsung via URL: `domain.com/user@domain.com`
- PIN proteksi alias (opsional, diatur admin)
- Auto-clear inbox saat ganti alias

### Admin Dashboard
- Login via Supabase Auth (email/password) + allowlist `ADMIN_EMAILS`
- Statistik: total alias, domain, email, akses
- Manajemen alias: buat dengan domain picker + generate acak, PIN proteksi, filter email
- Daftar alias dengan tab (Semua / Dikonfigurasi / Tanpa Konfigurasi)
- Kotak masuk admin: searchable alias picker, baca semua email tanpa filter
- Log email: card-style list, klik untuk buka detail
- Manajemen domain: tambah/hapus/toggle aktif
- API Key management: buat, revoke, rotate
- Tema: ganti tema UI dari dashboard
- Audit log: semua aksi admin tercatat

### Partner API v1
- Autentikasi via `x-api-key` header (SHA-256 hashed, timing-safe)
- Scope-based: `alias:create`, `messages:read`, `otp:read`
- Rate limiting per key
- IP & domain restriction per key
- Isolasi alias per key
- Polling OTP dengan `waitSeconds`

### Keamanan
- Token Gmail terenkripsi AES-128-CBC (opsional)
- Proactive token refresh (5 menit sebelum expire)
- Preserve refresh_token saat auto-refresh
- OAuth state CSRF protection (TTL 10 menit)
- Input validation (Zod)
- Audit trail admin actions
- PIN alias (SHA-256 hashed, timing-safe comparison)

### Performa & Reliability
- Message cache (TTL 30 detik)
- SSE real-time push (via Gmail Pub/Sub webhook)
- Stale response detection (discard jika alias berubah)
- Upsert-based storage (no data loss dari race condition)
- Structured JSON logging
- Health check endpoints

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Frontend | React 18 + Bootstrap 5 + Bootstrap Icons |
| Backend | Next.js API Routes (Node.js runtime) |
| Auth Admin | Supabase Auth (email/password) |
| Auth Partner | API Key (SHA-256 + pepper) |
| Email Source | Gmail API (read-only) via Google OAuth2 |
| Storage | Supabase PostgreSQL |
| Validation | Zod |
| Deploy | Vercel + Cloudflare DNS/Email Routing |

## Struktur Proyek

```
app/
├── page.jsx                    # UI publik (inbox, OTP, tema)
├── [alias]/page.jsx            # Akses alias langsung via URL
├── layout.js                   # Root layout + Bootstrap CDN
├── globals.css                 # Global styles
├── admin/
│   ├── page.jsx                # Dashboard admin (semua fitur)
│   └── login/page.jsx          # Login admin
├── api/
│   ├── messages/
│   │   ├── route.js            # GET: list messages (+ PIN check)
│   │   ├── [id]/route.js       # GET: message detail
│   │   └── stream/route.js     # SSE: real-time push
│   ├── aliases/
│   │   ├── route.js            # POST: register alias
│   │   └── check-pin/route.js  # GET: cek apakah alias butuh PIN
│   ├── domains/route.js        # GET: list active domains
│   ├── theme/route.js          # GET: current theme
│   ├── admin/
│   │   ├── stats/route.js      # GET: dashboard stats
│   │   ├── aliases/route.js    # GET/POST: manage aliases
│   │   ├── aliases/[address]/route.js
│   │   ├── domains/route.js    # GET/POST: manage domains
│   │   ├── domains/[name]/route.js
│   │   ├── messages/route.js   # GET: admin inbox
│   │   ├── messages/[id]/route.js
│   │   ├── logs/route.js       # GET/DELETE: email logs
│   │   ├── keys/route.js       # GET/POST: API keys
│   │   ├── keys/[id]/route.js  # DELETE: revoke key
│   │   ├── keys/[id]/rotate/route.js
│   │   ├── theme/route.js      # GET/POST: theme
│   │   └── debug/storage/route.js
│   ├── v1/partner/
│   │   ├── aliases/route.js    # POST: create partner alias
│   │   ├── messages/route.js   # GET: partner inbox
│   │   ├── messages/[id]/route.js
│   │   ├── otp/route.js        # GET: poll OTP
│   │   └── health/route.js     # GET: key health
│   └── webhooks/
│       ├── cloudflare-email/route.js # POST: inbound Email Worker
│       └── gmail/
│           ├── route.js        # POST: Gmail push notification
│           └── watch/route.js  # POST: setup Gmail watch
├── auth/
│   ├── url/route.js            # GET: OAuth URL
│   └── revoke/route.js         # POST: revoke token
├── health/
│   ├── route.js                # GET: system health
│   └── token/route.js          # GET: token health + diagnostics
├── login/route.js              # GET: redirect to Google OAuth
├── oauth2callback/route.js     # GET: OAuth callback
└── docs/api-partner/page.jsx   # Dokumentasi Partner API

lib/
├── server/
│   ├── runtime.js              # Business logic (Gmail, storage, auth, partner)
│   └── respond.js              # Response helpers
└── supabaseClient.js           # Supabase client (browser)

supabase/
├── migrations/
│   ├── 20260204_0001_app_kv.sql
│   ├── 20260206_0001_app_tables.sql
│   ├── 20260421_0001_partner_api.sql
│   ├── 20260524_0001_alias_pin.sql
│   └── 20260912_0001_cloudflare_email_messages.sql
├── schema.template.sql
└── schema.tables.template.sql
```

## Database (Supabase)

| Tabel | Fungsi |
|-------|--------|
| `app_kv` | Key-value store (token, config, theme) |
| `app_aliases` | Alias email (address, hits, active, pin_hash) |
| `app_domains` | Domain yang diizinkan |
| `app_logs` | Log email masuk per alias |
| `app_messages` | Inbox utama dari Cloudflare Email Worker |
| `app_audit` | Audit trail admin actions |
| `app_api_keys` | Partner API keys |
| `app_partner_aliases` | Alias milik partner |
| `app_partner_access_logs` | Log akses partner API |

## Prasyarat

- Node.js 18+
- Akun Supabase (Auth + Database)
- Akun Google Cloud (Gmail API, opsional untuk fallback/backup lama)
- Domain + Cloudflare (Email Routing)

## Variabel Lingkungan

```env
# Google OAuth (opsional jika masih memakai Gmail API fallback)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback

# Admin
ADMIN_EMAILS=admin@domain.com

# Supabase Client
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase Server
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_KV_TABLE=app_kv
SUPABASE_TABLE_ALIASES=app_aliases
SUPABASE_TABLE_DOMAINS=app_domains
SUPABASE_TABLE_LOGS=app_logs
SUPABASE_TABLE_MESSAGES=app_messages
SUPABASE_TABLE_AUDIT=app_audit
SUPABASE_TABLE_API_KEYS=app_api_keys
SUPABASE_TABLE_PARTNER_ALIASES=app_partner_aliases
SUPABASE_TABLE_PARTNER_ACCESS_LOGS=app_partner_access_logs

# Opsional
ALLOWED_ORIGINS=http://localhost:3000
MAX_MESSAGES=20
TOKEN_ENCRYPTION_KEY=           # 32 hex chars untuk AES-128
PARTNER_API_ENABLED=true
PARTNER_KEY_PEPPER=
PARTNER_DEFAULT_RATE_LIMIT=60
PARTNER_MAX_WAIT_SECONDS=20
GMAIL_PUBSUB_TOPIC=             # projects/<id>/topics/gmail-push
CLOUDFLARE_EMAIL_WEBHOOK_SECRET= # secret untuk Email Worker webhook
```

## Instalasi

```bash
npm install
npm run dev
```

- User UI: http://localhost:3000
- Admin: http://localhost:3000/admin/login
- API Docs: http://localhost:3000/docs/api-partner

## Setup Supabase

1. Buat project Supabase
2. Aktifkan Email/Password Auth
3. Buat user admin (Auth → Users), auto-confirm
4. Jalankan semua migration SQL di `supabase/migrations/` secara berurutan
5. Set env variables Supabase

## Setup Google OAuth (Opsional, Gmail API Fallback)

1. Buat project di Google Cloud Console
2. Enable Gmail API
3. Buat OAuth Client (Web Application)
4. Set Authorized redirect URIs: `http://localhost:3000/oauth2callback`
5. **Penting**: Publish app (OAuth consent screen → Publish) agar refresh token tidak expire 7 hari
6. Set env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
7. Buka `/login` untuk autentikasi pertama kali

## Setup Cloudflare Email Routing

1. Tambahkan domain ke Cloudflare
2. Aktifkan Email Routing
3. Set MX records:
   - `route1.mx.cloudflare.net` (priority 49)
   - `route2.mx.cloudflare.net` (priority 50)
   - `route3.mx.cloudflare.net` (priority 50)
4. Set TXT SPF: `v=spf1 include:_spf.mx.cloudflare.net ~all`
5. Untuk mode sederhana, buat route: `*@domain.com` → destination email (Gmail)
6. Untuk mode tmail produksi, gunakan Cloudflare Email Worker agar email disimpan ke Supabase dan tetap bisa diforward ke Gmail backup
7. Tambahkan domain di admin dashboard

## Setup Cloudflare Email Worker (Direkomendasikan)

Mode ini menjadikan Supabase `app_messages` sebagai inbox utama sehingga refresh user tidak lagi bergantung ke Gmail API.

1. Jalankan migration `20260912_0001_cloudflare_email_messages.sql`
2. Set env aplikasi: `CLOUDFLARE_EMAIL_WEBHOOK_SECRET` dan `SUPABASE_TABLE_MESSAGES=app_messages`
3. Deploy Worker dari `cloudflare/email-worker.js`
4. Set Worker variables/secrets:
   - `APP_WEBHOOK_URL=https://domain-app.com/api/webhooks/cloudflare-email`
   - `WEBHOOK_SECRET` sama dengan `CLOUDFLARE_EMAIL_WEBHOOK_SECRET`
   - `BACKUP_EMAIL=alamatgmail@gmail.com` jika email tetap ingin masuk Gmail
5. Arahkan catch-all Email Routing ke Worker
6. Tes kirim email ke alias dan cek table `app_messages`

Dokumentasi lengkap: [`docs/cloudflare-email-worker.md`](docs/cloudflare-email-worker.md)

## Gmail Push Notification (Opsional)

Untuk real-time email tanpa polling:

1. Buat Pub/Sub topic di Google Cloud: `gmail-push`
2. Beri permission `Pub/Sub Publisher` ke `gmail-api-push@system.gserviceaccount.com`
3. Buat Push Subscription → endpoint: `https://domain.com/api/webhooks/gmail`
4. Set env: `GMAIL_PUBSUB_TOPIC=projects/<project-id>/topics/gmail-push`
5. Panggil `POST /api/webhooks/gmail/watch` (admin auth) — ulangi setiap 7 hari

## API Endpoints

### Publik
| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/api/messages?alias=&pin=` | List messages |
| GET | `/api/messages/:id` | Message detail |
| GET | `/api/domains` | Active domains |
| POST | `/api/aliases` | Register alias |
| GET | `/api/aliases/check-pin?alias=` | Cek PIN requirement |
| GET | `/api/theme` | Current theme |
| GET | `/api/messages/stream?alias=` | SSE real-time |
| POST | `/api/webhooks/cloudflare-email` | Webhook inbound Cloudflare Email Worker |

### Admin (Bearer token)
| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/api/admin/stats` | Dashboard stats |
| GET/POST | `/api/admin/aliases` | List/create alias |
| PUT/DELETE | `/api/admin/aliases/:address` | Update/archive |
| GET/POST | `/api/admin/domains` | List/add domain |
| PUT/DELETE | `/api/admin/domains/:name` | Toggle/delete |
| GET | `/api/admin/messages?alias=` | Admin inbox |
| GET | `/api/admin/messages/:id` | Message detail |
| GET/DELETE | `/api/admin/logs` | View/clear logs |
| GET/POST | `/api/admin/keys` | List/create API key |
| DELETE | `/api/admin/keys/:id` | Revoke key |
| POST | `/api/admin/keys/:id/rotate` | Rotate key |
| GET/POST | `/api/admin/theme` | Get/set theme |

### Partner API v1 (`x-api-key` header)
| Method | Path | Scope |
|--------|------|-------|
| POST | `/api/v1/partner/aliases` | `alias:create` |
| GET | `/api/v1/partner/messages?alias=` | `messages:read` |
| GET | `/api/v1/partner/messages/:id?alias=` | `messages:read` |
| GET | `/api/v1/partner/otp?alias=&waitSeconds=` | `otp:read` |
| GET | `/api/v1/partner/health` | any valid key |

### Health & Auth
| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/health` | System health |
| GET | `/health/token` | Token health + diagnostics |
| GET | `/login` | Redirect ke Google OAuth |
| GET | `/oauth2callback` | OAuth callback |
| GET | `/auth/url` | Get OAuth URL (JSON) |
| POST | `/auth/revoke` | Revoke Gmail token |

## Deploy ke Vercel

1. Push ke GitHub
2. Import project di Vercel
3. Set semua environment variables
4. Pastikan `GOOGLE_REDIRECT_URI` pakai domain produksi
5. Deploy

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| 401 admin API | Pastikan login sukses dan email ada di `ADMIN_EMAILS` |
| OAuth `redirect_uri_mismatch` | Samakan `GOOGLE_REDIRECT_URI` dengan Google Console |
| Token sering expire | Publish app di Google Cloud (bukan Testing mode) |
| Email tidak masuk | Cek MX, SPF, dan route di Cloudflare |
| Email masuk Gmail tapi tidak muncul di UI | Cek Worker route, Worker logs, secret webhook, dan table `app_messages` |
| PIN tidak tersimpan | Jalankan migration `20260524_0001_alias_pin.sql` |
| Alias hilang dari DB | Sudah diperbaiki — storage pakai upsert, bukan delete+insert |

## Lisensi

Private — hanya untuk penggunaan internal.
