
create table public.admin_login_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index admin_login_codes_expires_idx on public.admin_login_codes (expires_at);

create table public.admin_sessions (
  token text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index admin_sessions_expires_idx on public.admin_sessions (expires_at);

alter table public.admin_login_codes enable row level security;
alter table public.admin_sessions enable row level security;
