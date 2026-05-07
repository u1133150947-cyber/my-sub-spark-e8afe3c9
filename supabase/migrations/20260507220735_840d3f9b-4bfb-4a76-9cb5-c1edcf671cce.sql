create table if not exists public.panel_health (
  id uuid primary key default gen_random_uuid(),
  panel_slug text not null,
  status text not null,
  latency_ms integer,
  message text,
  checked_at timestamptz not null default now()
);
create index if not exists panel_health_panel_time_idx on public.panel_health(panel_slug, checked_at desc);

alter table public.panel_health enable row level security;
create policy "public read panel_health" on public.panel_health for select using (true);
create policy "public insert panel_health" on public.panel_health for insert with check (true);
create policy "public delete panel_health" on public.panel_health for delete using (true);