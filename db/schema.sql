-- LeadScraper Dakar — schéma PostgreSQL (Supabase)
-- Installation : exécuter ce fichier dans l'éditeur SQL Supabase, puis créer le rôle applicatif (bas du fichier).

create schema if not exists app;

create table app.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  status text not null default 'active' check (status in ('active','suspended')),
  suspended_reason text,
  suspended_at timestamptz,
  plan text not null default 'pro',
  monthly_lead_quota integer not null default 2000,
  max_users integer not null default 3,
  subscription_ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references app.organizations(id) on delete cascade,
  email text not null unique,
  password_hash text not null,
  full_name text,
  role text not null default 'member' check (role in ('superadmin','owner','member')),
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on app.users(organization_id);

create table app.sessions (
  id text primary key,
  user_id uuid not null references app.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text,
  user_agent text
);
create index on app.sessions(user_id);

create table app.login_attempts (
  id bigserial primary key,
  email text,
  ip text,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index on app.login_attempts(email, created_at);
create index on app.login_attempts(ip, created_at);

create table app.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  user_id uuid references app.users(id) on delete set null,
  title text not null,
  params jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  stage text not null default 'search',
  tasks_total integer not null default 0,
  tasks_done integer not null default 0,
  leads_count integer not null default 0,
  message text,
  error text,
  provider_stats jsonb not null default '{}'::jsonb,
  log jsonb not null default '[]'::jsonb,
  locked_until timestamptz,
  lock_id text,
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index on app.jobs(organization_id, created_at desc);
create index on app.jobs(status);

create table app.job_tasks (
  id bigserial primary key,
  job_id uuid not null references app.jobs(id) on delete cascade,
  kind text not null check (kind in ('search','enrich')),
  position integer not null default 0,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts integer not null default 0,
  provider text,
  result_count integer,
  error text,
  updated_at timestamptz not null default now()
);
create index on app.job_tasks(job_id, status, position);

create table app.leads (
  id bigserial primary key,
  job_id uuid not null references app.jobs(id) on delete cascade,
  organization_id uuid not null references app.organizations(id) on delete cascade,
  dedupe_key text not null,
  name text not null,
  category text,
  activity text,
  zone text,
  phone text,
  phone_intl text,
  operator text,
  whatsapp text,
  email text,
  emails text[] not null default '{}',
  website text,
  address text,
  latitude double precision,
  longitude double precision,
  rating numeric(3,2),
  reviews_count integer,
  maps_url text,
  place_id text,
  facebook text,
  instagram text,
  linkedin text,
  twitter text,
  tiktok text,
  youtube text,
  opening_hours text,
  business_status text,
  source text,
  enriched boolean not null default false,
  created_at timestamptz not null default now(),
  unique (job_id, dedupe_key)
);
create index on app.leads(organization_id, created_at);
create index on app.leads(job_id, id);

create table app.provider_health (
  provider text primary key,
  consecutive_failures integer not null default 0,
  total_success integer not null default 0,
  total_failures integer not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  cooldown_until timestamptz
);

create table app.audit_logs (
  id bigserial primary key,
  actor_user_id uuid,
  actor_email text,
  organization_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index on app.audit_logs(created_at desc);

create table app.access_requests (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text,
  email text,
  phone text,
  message text,
  status text not null default 'new' check (status in ('new','contacted','converted','rejected')),
  ip text,
  created_at timestamptz not null default now()
);

-- Le schéma app n'est pas exposé via l'API publique : seul le rôle applicatif y accède.
revoke all on schema app from public;

-- Rôle applicatif (remplacer le mot de passe) :
-- create role leadscraper_app login password 'CHANGER-MOI' noinherit;
grant usage on schema app to leadscraper_app;
grant select, insert, update, delete on all tables in schema app to leadscraper_app;
grant usage, select on all sequences in schema app to leadscraper_app;
alter default privileges in schema app grant select, insert, update, delete on tables to leadscraper_app;
alter default privileges in schema app grant usage, select on sequences to leadscraper_app;
