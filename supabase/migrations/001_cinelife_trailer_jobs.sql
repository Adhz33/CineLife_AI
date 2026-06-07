create extension if not exists "pgcrypto";

create table if not exists public.trailer_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null default '',
  future_dream text not null default '',
  trailer_style text not null default 'Inspirational',
  voice_option text not null default 'Cinematic Male',
  status text not null default 'created',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  stage text not null default 'Session',
  error text,
  result_video_url text,
  download_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trailer_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.trailer_jobs(id) on delete cascade,
  user_id uuid not null,
  asset_type text not null,
  resource_type text not null,
  public_id text not null,
  secure_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trailer_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.trailer_jobs(id) on delete cascade,
  user_id uuid not null,
  status text,
  stage text,
  progress integer check (progress is null or (progress >= 0 and progress <= 100)),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trailer_jobs_user_created_idx
  on public.trailer_jobs(user_id, created_at desc);

create index if not exists trailer_assets_job_idx
  on public.trailer_assets(job_id, user_id);

create index if not exists trailer_events_job_idx
  on public.trailer_events(job_id, user_id, created_at desc);

alter table public.trailer_jobs enable row level security;
alter table public.trailer_assets enable row level security;
alter table public.trailer_events enable row level security;

drop policy if exists "Users can read own trailer jobs" on public.trailer_jobs;
create policy "Users can read own trailer jobs"
  on public.trailer_jobs
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own trailer assets" on public.trailer_assets;
create policy "Users can read own trailer assets"
  on public.trailer_assets
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own trailer events" on public.trailer_events;
create policy "Users can read own trailer events"
  on public.trailer_events
  for select
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('cinelife-job-artifacts', 'cinelife-job-artifacts', false)
on conflict (id) do nothing;
