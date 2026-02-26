-- Run this in Supabase SQL editor to create the clinic_diagnostics table.

create table if not exists clinic_diagnostics (
  id uuid primary key default gen_random_uuid(),
  clinic_name text not null,
  input_data jsonb not null default '{}',
  ontology_state jsonb,
  projections jsonb,
  narrative text,
  created_at timestamptz not null default now()
);

-- Optional: RLS (enable if you use Supabase auth)
-- alter table clinic_diagnostics enable row level security;
-- create policy "Allow anonymous insert" on clinic_diagnostics for insert with (true);
-- create policy "Allow read by id" on clinic_diagnostics for select using (true);
