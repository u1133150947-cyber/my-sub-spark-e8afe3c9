create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  level text not null default 'info',
  action text not null,
  panel_slug text,
  subscription_id uuid,
  status text,
  duration_ms integer,
  error text,
  request_id text,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_ts_idx on public.audit_log(ts desc);
create index if not exists audit_log_level_idx on public.audit_log(level, ts desc);
create index if not exists audit_log_action_idx on public.audit_log(action, ts desc);
create index if not exists audit_log_request_idx on public.audit_log(request_id);

alter table public.audit_log enable row level security;
create policy "public read audit_log" on public.audit_log for select using (true);
create policy "public insert audit_log" on public.audit_log for insert with check (true);
create policy "public delete audit_log" on public.audit_log for delete using (true);