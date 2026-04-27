-- ============================================================================
-- NIMHANS — Genetics in Epilepsy Registry
-- Supabase / PostgreSQL schema (v2 — full 87-column template).
--
-- HOW TO USE
-- 1. Create a free Supabase project at https://supabase.com.
-- 2. Open the SQL Editor (left sidebar) and paste this entire file.
-- 3. Click "Run".  All tables, policies and seed user are created in one shot.
-- 4. Go to Settings → API and copy the Project URL and the anon public key
--    into js/config.js.
--
-- The web app keeps the bundled cohort (370 rows from N1/N2/N3/N5) inside
-- js/seed.js, so the dashboard works offline.  Once Supabase is configured,
-- use the "♻ Wipe DB & reload bundled cohort" button on the Upload screen
-- to push that seed into the database.
-- ============================================================================

-- 1. Patient + variant rows ---------------------------------------------------
create table if not exists patient_variants (
  id              bigint primary key,
  category        text,
  name            text not null,
  age_enroll      text,
  sex             text,
  nnum            text,
  uhid            text,
  gene            text,
  location        text,
  variant         text,
  zyg             text,
  disease         text,
  omim            text,
  inh             text,
  classification  text,
  type_test       text,
  pretest         text,
  aao             text,
  sz_type         text,
  eeg             text,
  mri             text,
  consang         text,
  ext             jsonb,           -- holds the remaining 65 template fields
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- If migrating from v1, add the new column non-destructively
alter table patient_variants add column if not exists ext jsonb;

create index if not exists idx_pv_nnum     on patient_variants(nnum);
create index if not exists idx_pv_uhid     on patient_variants(uhid);
create index if not exists idx_pv_category on patient_variants(category);
create index if not exists idx_pv_class    on patient_variants(classification);
create index if not exists idx_pv_gene     on patient_variants(gene);

-- 2. Registry users ----------------------------------------------------------
create table if not exists registry_users (
  id          text primary key,
  pw          text not null,           -- demo only; replace with Supabase Auth in prod
  name        text not null,
  role        text not null check (role in ('admin','clinician','viewer','researcher','doctor')),
  email       text,
  "protected" boolean default false,
  created_at  timestamptz default now()
);

-- 3. Row-Level Security ------------------------------------------------------
alter table patient_variants enable row level security;
alter table registry_users   enable row level security;

drop policy if exists "anon read pv"  on patient_variants;
drop policy if exists "anon write pv" on patient_variants;
drop policy if exists "anon read u"   on registry_users;
drop policy if exists "anon write u"  on registry_users;

create policy "anon read pv"  on patient_variants for select using (true);
create policy "anon write pv" on patient_variants for all    using (true) with check (true);
create policy "anon read u"   on registry_users   for select using (true);
create policy "anon write u"  on registry_users   for all    using (true) with check (true);

-- 4. Seed user ---------------------------------------------------------------
insert into registry_users (id, pw, name, role, email, "protected") values
  ('admin','273070','Administrator','admin','admin@nimhans.ac.in', true)
on conflict (id) do nothing;

-- 5. Wipe demo seed rows from v1 ---------------------------------------------
-- Removes the placeholder records that ship with v1.  Real data is loaded
-- from the bundled seed file via the "Wipe & reload" button, or manually
-- via the Upload Reports screen.
delete from patient_variants where id between 1 and 5;

-- Done.  Verify with:
--   select count(*) from patient_variants;
--   select * from registry_users;
