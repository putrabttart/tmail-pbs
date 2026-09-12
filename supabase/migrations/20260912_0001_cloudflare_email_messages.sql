-- Store inbound email delivered by Cloudflare Email Workers.
-- Gmail API remains available as fallback, but app_messages is the primary inbox source.
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
