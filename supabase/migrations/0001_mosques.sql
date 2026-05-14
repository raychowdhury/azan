-- Verified mosque database + public submission queue for Azan Times.
-- Run via Supabase SQL editor or `supabase db push`.
--
-- Tables:
--   mosques              — moderator-curated rows surfaced in the app
--   mosque_submissions   — public/community submissions awaiting review
--
-- Security:
--   - The app uses the anon key client-side.
--   - SELECT on mosques is allowed only for rows with verified=true.
--   - INSERT on mosque_submissions is allowed; SELECT/UPDATE/DELETE blocked
--     for anon. Moderators use the service-role key from the dashboard.

create extension if not exists "pgcrypto";

create table if not exists public.mosques (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  address         text,
  latitude        double precision not null,
  longitude       double precision not null,
  phone           text,
  website         text,
  iqamah          jsonb,
  jumuah          jsonb,
  languages       text[],
  facilities      text[],
  notes           text,
  verified        boolean not null default false,
  source_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists mosques_verified_idx on public.mosques (verified);
create index if not exists mosques_lat_lng_idx on public.mosques (latitude, longitude);

create table if not exists public.mosque_submissions (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  address            text,
  latitude           double precision,
  longitude          double precision,
  phone              text,
  website            text,
  iqamah             jsonb,
  jumuah             jsonb,
  languages          text[],
  facilities         text[],
  notes              text,
  submitter_contact  text,
  status             text not null default 'pending',
  reviewer_notes     text,
  created_at         timestamptz not null default now(),
  reviewed_at        timestamptz
);

create index if not exists mosque_submissions_status_idx on public.mosque_submissions (status, created_at desc);

-- RLS
alter table public.mosques enable row level security;
alter table public.mosque_submissions enable row level security;

-- Public can read only verified rows.
drop policy if exists mosques_read_verified on public.mosques;
create policy mosques_read_verified
  on public.mosques
  for select
  to anon, authenticated
  using (verified = true);

-- Public can insert submissions; no read/update/delete.
drop policy if exists mosque_submissions_insert on public.mosque_submissions;
create policy mosque_submissions_insert
  on public.mosque_submissions
  for insert
  to anon, authenticated
  with check (true);

-- Touch updated_at on mosques edits.
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists mosques_set_updated_at on public.mosques;
create trigger mosques_set_updated_at
  before update on public.mosques
  for each row execute function public.set_updated_at();
