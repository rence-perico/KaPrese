-- Run this once in your Supabase project's SQL Editor (Supabase Dashboard
-- -> SQL Editor -> New query -> paste this whole file -> Run).
--
-- It creates one shared key/value table that stores everything the app
-- needs: KK member records, SK officials, and the admin/barangay passcodes.
-- This mirrors how the original Claude Artifact used shared storage.

create table if not exists kv_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: this app has no real user accounts (access is
-- controlled by the passcodes stored inside the app itself), so we allow
-- the public "anon" key to read and write every row. Anyone with your
-- Supabase URL + anon key can technically hit this table directly, so:
--   1. Never expose your Supabase "service_role" key in the frontend.
--   2. Treat the passcodes as a light deterrent, not real security.
--   3. If you need real security later, add Supabase Auth + real RLS
--      policies scoped to authenticated users.

alter table kv_store enable row level security;

create policy "Public can read kv_store"
  on kv_store for select
  to anon
  using (true);

create policy "Public can insert kv_store"
  on kv_store for insert
  to anon
  with check (true);

create policy "Public can update kv_store"
  on kv_store for update
  to anon
  using (true)
  with check (true);

create policy "Public can delete kv_store"
  on kv_store for delete
  to anon
  using (true);
