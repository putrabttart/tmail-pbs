-- Add PIN protection to aliases
-- PIN is stored as SHA-256 hash, null means no PIN required
alter table public.app_aliases add column if not exists pin_hash text;
