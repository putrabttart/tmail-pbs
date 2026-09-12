# Setup PBS Mail / TMail

Panduan ini menjelaskan setup production terbaru untuk PBS Mail dengan Cloudflare Email Worker sebagai sumber inbox utama. Gmail API tidak wajib; Gmail bisa tetap menerima salinan email melalui `BACKUP_EMAIL` di Worker.

## Arsitektur Terbaru

```text
email ke alias@domain.com
  -> Cloudflare Email Routing catch-all
  -> Cloudflare Email Worker
  -> POST https://app-domain/api/webhooks/cloudflare-email
  -> Supabase app_messages
  -> UI TMail / Partner API

opsional:
  -> Worker forward salinan email ke Gmail backup
```

## 1. Prasyarat

- Node.js 20 direkomendasikan.
- Project Supabase aktif.
- Project sudah deploy ke Vercel/hosting HTTPS.
- Domain email sudah memakai Cloudflare nameserver.
- Cloudflare Email Routing aktif.
- Gmail backup sudah diverifikasi di Cloudflare jika ingin email tetap masuk Gmail.

## 2. Setup Supabase

Buat project Supabase, lalu aktifkan Email/Password Auth untuk admin.

Buat user admin di:

```text
Supabase Dashboard -> Authentication -> Users -> Add user
```

Jalankan semua migration SQL di folder ini secara berurutan:

```text
supabase/migrations/
```

Migration penting untuk mode Worker:

```text
supabase/migrations/20260912_0001_cloudflare_email_messages.sql
```

Jika ingin menjalankan SQL manual, gunakan:

```sql
create table if not exists public.app_messages (
  id text primary key,
  alias text not null,
  from_email text,
  to_email text,
  subject text,
  date timestamptz,
  snippet text,
  body_text text,
  body_html text,
  raw text,
  headers jsonb not null default '{}'::jsonb,
  source text not null default 'cloudflare_email_worker',
  created_at timestamptz not null default now()
);

create index if not exists idx_app_messages_alias_created_at
on public.app_messages(alias, created_at desc);

create index if not exists idx_app_messages_created_at
on public.app_messages(created_at desc);

alter table public.app_messages disable row level security;

notify pgrst, 'reload schema';
```

Verifikasi tabel:

```sql
select count(*) from public.app_messages;
```

## 3. Environment Aplikasi

Gunakan `env.example` sebagai template. Jangan commit file `.env` asli.

Contoh production untuk Vercel:

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://tmail-pbs-eight.vercel.app
LOG_LEVEL=info
MAX_MESSAGES=20
MAX_LOGS=5000

ADMIN_EMAILS=admin@domainkamu.com
ADMIN_API_KEY=

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_KV_TABLE=app_kv
SUPABASE_TABLE_ALIASES=app_aliases
SUPABASE_TABLE_DOMAINS=app_domains
SUPABASE_TABLE_LOGS=app_logs
SUPABASE_TABLE_MESSAGES=app_messages
SUPABASE_TABLE_AUDIT=app_audit
SUPABASE_TABLE_API_KEYS=app_api_keys
SUPABASE_TABLE_PARTNER_ALIASES=app_partner_aliases
SUPABASE_TABLE_PARTNER_ACCESS_LOGS=app_partner_access_logs

CLOUDFLARE_EMAIL_WEBHOOK_SECRET=isi-secret-panjang-random

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GMAIL_PUBSUB_TOPIC=

DATA_DIR=
TOKEN_PATH=
TOKEN_ENCRYPTION_KEY=

PARTNER_API_ENABLED=true
PARTNER_KEY_PEPPER=isi-random-pepper
PARTNER_DEFAULT_RATE_LIMIT=60
PARTNER_MAX_WAIT_SECONDS=20
```

`CLOUDFLARE_EMAIL_WEBHOOK_SECRET` harus sama persis dengan `WEBHOOK_SECRET` di Cloudflare Worker.

Google env bersifat opsional. Kosongkan jika Worker menjadi inbox utama dan Gmail API tidak dipakai.

## 4. Deploy Aplikasi

Push kode ke GitHub dan deploy ke Vercel.

Set environment variables di:

```text
Vercel Project -> Settings -> Environment Variables
```

Redeploy setelah mengubah env.

Cek webhook health:

```text
https://tmail-pbs-eight.vercel.app/api/webhooks/cloudflare-email
```

Response sehat:

```json
{
  "ok": true,
  "webhookSecretConfigured": true,
  "useSupabaseStorage": true,
  "table": "app_messages",
  "messagesTable": {
    "ok": true,
    "error": null,
    "count": 0
  }
}
```

Jika `ok` bukan `true`, perbaiki env aplikasi atau migration Supabase sebelum lanjut ke Cloudflare.

## 5. Setup Cloudflare Email Routing

Buka Cloudflare Dashboard dan pilih domain email.

Aktifkan Email Routing di:

```text
Domain -> Email -> Email Routing
```

Pastikan DNS record Email Routing aktif:

```text
MX route1.mx.cloudflare.net priority 49
MX route2.mx.cloudflare.net priority 50
MX route3.mx.cloudflare.net priority 50
TXT SPF v=spf1 include:_spf.mx.cloudflare.net ~all
```

Jika ingin email tetap masuk Gmail, tambahkan destination Gmail di:

```text
Email Routing -> Destination addresses -> Add destination address
```

Verifikasi Gmail lewat email yang dikirim Cloudflare.

## 6. Buat Cloudflare Worker

Buka:

```text
Cloudflare Dashboard -> Workers & Pages -> Create application -> Make something new
```

Pilih Worker/Hello World/Start from scratch, lalu beri nama:

```text
tmail-email-worker
```

Masuk ke editor Worker dan paste isi file:

```text
cloudflare/email-worker.js
```

Klik `Save and deploy`.

## 7. Set Worker Variables

Buka:

```text
Workers & Pages -> tmail-email-worker -> Settings -> Variables and Secrets
```

Tambahkan:

```text
APP_WEBHOOK_URL=https://tmail-pbs-eight.vercel.app/api/webhooks/cloudflare-email
WEBHOOK_SECRET=isi-sama-dengan-CLOUDFLARE_EMAIL_WEBHOOK_SECRET
BACKUP_EMAIL=emailgmailkamu@gmail.com
```

`BACKUP_EMAIL` opsional. Jika diisi, email tetap masuk Gmail.

Pastikan nama variable persis:

```text
APP_WEBHOOK_URL
WEBHOOK_SECRET
BACKUP_EMAIL
```

Setelah mengubah variable, klik `Save and deploy`.

## 8. Cek Worker Health

Buka URL Worker:

```text
https://tmail-email-worker.putrabttart.workers.dev/
```

Response sehat:

```json
{
  "ok": true,
  "worker": "tmail-email-worker",
  "hasAppWebhookUrl": true,
  "hasWebhookSecret": true,
  "hasBackupEmail": true,
  "appWebhookUrl": "https://tmail-pbs-eight.vercel.app/api/webhooks/cloudflare-email"
}
```

Jika `hasAppWebhookUrl` bernilai `false`, tambahkan `APP_WEBHOOK_URL` di Worker variables.

Jika `hasWebhookSecret` bernilai `false`, tambahkan `WEBHOOK_SECRET` di Worker secrets.

## 9. Hubungkan Email Routing Ke Worker

Buka:

```text
Domain -> Email -> Email Routing -> Routing rules
```

Buat catch-all rule:

```text
Catch-all -> Send to Worker -> tmail-email-worker
```

Pastikan route yang dipakai untuk tmail bukan langsung ke Gmail. Gmail backup harus lewat Worker `BACKUP_EMAIL`, bukan routing langsung.

## 10. Tambahkan Domain Di Admin TMail

Buka admin app:

```text
https://tmail-pbs-eight.vercel.app/admin
```

Tambahkan domain email, misalnya:

```text
pbsmailer.tech
```

Yang ditambahkan adalah domain email alias, bukan domain aplikasi Vercel.

## 11. Test End-To-End

Kirim email ke alias random:

```text
testworker123@pbsmailer.tech
```

Cek Cloudflare Worker logs:

```text
Workers & Pages -> tmail-email-worker -> Logs
```

Log sukses:

```text
Inbound email received
Inbound email saved to app
```

Cek Supabase:

```sql
select id, alias, from_email, subject, created_at, source
from public.app_messages
order by created_at desc
limit 10;
```

Buka TMail dengan alias yang sama:

```text
https://tmail-pbs-eight.vercel.app/testworker123@pbsmailer.tech
```

Email juga masuk Gmail jika `BACKUP_EMAIL` diisi.

## 12. Troubleshooting

| Gejala | Penyebab Umum | Solusi |
|--------|---------------|--------|
| Webhook health `ok: false` | Env app atau Supabase belum siap | Cek `CLOUDFLARE_EMAIL_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan migration |
| Worker health `hasAppWebhookUrl: false` | `APP_WEBHOOK_URL` belum diset | Tambahkan variable di Worker lalu `Save and deploy` |
| Worker health `hasWebhookSecret: false` | `WEBHOOK_SECRET` belum diset | Tambahkan secret di Worker lalu `Save and deploy` |
| Email masuk Gmail tapi `app_messages` kosong | Worker forward berhasil tapi POST gagal | Cek Worker logs dan pastikan `APP_WEBHOOK_URL` benar |
| `App webhook returned 401` | Secret Worker dan app berbeda | Samakan `WEBHOOK_SECRET` dengan `CLOUDFLARE_EMAIL_WEBHOOK_SECRET` |
| `App webhook returned 400` | Domain alias belum aktif atau recipient invalid | Tambahkan domain email di admin TMail |
| `App webhook returned 500` | Error Supabase/schema/server | Cek response log, migration, dan Vercel logs |
| Email tidak masuk Gmail | `BACKUP_EMAIL` kosong atau belum verified | Isi `BACKUP_EMAIL` dan verifikasi destination Gmail di Cloudflare |
| TMail kosong tapi `app_messages` ada isi | Alias yang dibuka beda dengan kolom `alias` | Buka alias yang sama persis dengan email tujuan |

## 13. Catatan Produksi

Gunakan secret panjang random minimal 32 karakter.

Jangan commit `.env`, `.env.old`, `.next`, atau `node_modules`.

Setelah mengganti env di Vercel atau Cloudflare Worker, selalu redeploy.

Untuk tmail berbasis OTP, attachment tidak disimpan khusus. Raw email tetap disimpan di kolom `raw` untuk parsing/detail.

Gmail API dapat tetap kosong jika mode Worker sudah aktif.
