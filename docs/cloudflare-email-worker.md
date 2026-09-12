# Cloudflare Email Worker

Dokumen ini menjelaskan setup inbox utama berbasis Cloudflare Email Worker. Dengan mode ini, aplikasi tidak perlu polling Gmail API untuk inbox normal. Email masuk disimpan ke Supabase table `app_messages`, lalu frontend membaca dari Supabase.

## Arsitektur

```text
email ke alias@domain.com
  -> Cloudflare Email Routing
  -> Cloudflare Email Worker
  -> POST /api/webhooks/cloudflare-email
  -> Supabase app_messages
  -> UI / API messages

opsional:
  -> Worker forward salinan email ke Gmail backup
```

## Kelebihan

- Mengurangi risiko limit Gmail API karena refresh inbox membaca Supabase.
- Lebih cocok untuk tmail/OTP karena email diproses saat masuk.
- Gmail tetap bisa menerima salinan email sebagai backup.
- Alias catch-all tetap bisa dipakai tanpa membuat mailbox satu per satu.

## Prasyarat

- Domain sudah aktif di Cloudflare.
- Cloudflare Email Routing aktif.
- Aplikasi Next.js sudah deploy dengan HTTPS publik.
- Supabase service role tersedia di server app.
- Migration `20260912_0001_cloudflare_email_messages.sql` sudah dijalankan.

## Environment Aplikasi

Tambahkan env ini di aplikasi Next.js:

```env
CLOUDFLARE_EMAIL_WEBHOOK_SECRET=isi-secret-panjang-random
SUPABASE_TABLE_MESSAGES=app_messages
```

`CLOUDFLARE_EMAIL_WEBHOOK_SECRET` harus sama dengan secret `WEBHOOK_SECRET` di Worker.

## Migration Supabase

Jalankan migration terbaru:

```sql
-- supabase/migrations/20260912_0001_cloudflare_email_messages.sql
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
```

Setelah menjalankan SQL, reload schema cache bila perlu:

```sql
notify pgrst, 'reload schema';
```

## Deploy Worker

Contoh Worker tersedia di:

```text
cloudflare/email-worker.js
```

Worker melakukan dua hal:

- POST raw email ke aplikasi.
- Forward email ke Gmail backup jika `BACKUP_EMAIL` diisi.

Secret/variable Worker yang dibutuhkan:

```text
APP_WEBHOOK_URL=https://domain-app.com/api/webhooks/cloudflare-email
WEBHOOK_SECRET=secret-sama-dengan-CLOUDFLARE_EMAIL_WEBHOOK_SECRET
BACKUP_EMAIL=alamatgmail@gmail.com
```

`BACKUP_EMAIL` opsional. Jika diisi, email tetap masuk ke Gmail seperti alur lama.

## Setup Cloudflare Dashboard

1. Buka Cloudflare dashboard.
2. Pilih domain.
3. Buka Email Routing.
4. Pastikan MX records Email Routing sudah aktif.
5. Tambahkan destination address Gmail jika ingin backup.
6. Buat Email Worker dari isi `cloudflare/email-worker.js`.
7. Tambahkan Worker variables/secrets:
   - `APP_WEBHOOK_URL`
   - `WEBHOOK_SECRET`
   - `BACKUP_EMAIL` jika ingin salinan ke Gmail
8. Buat routing rule/catch-all agar email domain masuk ke Worker.
9. Tes kirim email ke alias acak, misalnya `test123@domain.com`.
10. Cek Supabase table `app_messages` dan UI inbox aplikasi.

## Endpoint Aplikasi

Worker mengirim email ke:

```text
POST /api/webhooks/cloudflare-email
```

Health check webhook tersedia di:

```text
GET /api/webhooks/cloudflare-email
```

Response sehat contoh:

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

Header wajib:

```text
X-Webhook-Secret: <secret>
Content-Type: application/json
```

Payload utama:

```json
{
  "from": "sender@example.com",
  "to": "alias@domain.com",
  "alias": "alias@domain.com",
  "headers": {},
  "rawBase64": "..."
}
```

`rawBase64` dipakai agar raw MIME aman dikirim melalui JSON.

## Cara Kerja Inbox Setelah Perubahan

API berikut sekarang membaca `app_messages` terlebih dahulu:

```text
GET /api/messages?alias=alias@domain.com
GET /api/messages/:id
GET /api/admin/messages?alias=alias@domain.com
GET /api/admin/messages/:id
```

Jika `app_messages` belum tersedia, aplikasi masih fallback ke Gmail API. Jika tabel sudah tersedia tetapi alias belum punya email, API mengembalikan inbox kosong tanpa memanggil Gmail.

## Catatan PIN Alias

PIN tetap divalidasi sebelum inbox ditampilkan. Email tetap disimpan saat masuk, tetapi user publik tetap harus memasukkan PIN untuk membaca alias yang dilindungi.

## Gmail API Setelah Worker Aktif

Gmail API masih bisa dipertahankan untuk:

- fallback sementara,
- import email lama,
- cek manual token health,
- backup alur lama.

Setelah Worker stabil, polling Gmail bisa dibuat lebih jarang atau fallback bisa dimatikan di perubahan berikutnya.

## Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| 401 dari webhook | Secret Worker tidak sama | Samakan `WEBHOOK_SECRET` dan `CLOUDFLARE_EMAIL_WEBHOOK_SECRET` |
| 400 invalid recipient alias | `message.to` bukan email domain yang valid | Pastikan routing rule mengirim alamat tujuan asli |
| Domain not allowed | Domain belum aktif di admin app | Tambahkan domain di dashboard admin |
| Pesan tidak muncul di UI | Migration belum jalan atau Worker belum route | Cek table `app_messages`, Worker logs, dan route Email Routing |
| Email masuk Gmail tapi `app_messages` kosong | Worker forward berhasil tapi POST ke app gagal atau tidak terpanggil | Cek Worker logs, `APP_WEBHOOK_URL`, `WEBHOOK_SECRET`, dan `GET /api/webhooks/cloudflare-email` |
| Email tidak masuk Gmail | `BACKUP_EMAIL` kosong atau forward gagal | Isi `BACKUP_EMAIL` dan pastikan destination address terverifikasi |
| Supabase schema cache error | Migration baru belum terbaca PostgREST | Jalankan `notify pgrst, 'reload schema';` |

## Rekomendasi Produksi

- Gunakan secret panjang random minimal 32 karakter.
- Batasi ukuran email jika nanti ada spam/attachment besar.
- Tambahkan cleanup email lama sesuai kebutuhan, misalnya hapus email lebih dari 7 hari.
- Pantau Worker logs saat awal deploy.
- Tetap forward ke Gmail selama masa transisi.
