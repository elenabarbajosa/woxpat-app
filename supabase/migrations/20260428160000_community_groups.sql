-- Community groups (admin-only feature). Run in Supabase SQL editor or via CLI.

create table if not exists public.community_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists community_groups_created_at_idx
  on public.community_groups (created_at desc);

create table if not exists public.community_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups (id) on delete cascade,
  registration_id bigint not null references public.registrations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, registration_id)
);

create index if not exists community_group_members_group_id_idx
  on public.community_group_members (group_id);

create index if not exists community_group_members_registration_id_idx
  on public.community_group_members (registration_id);

create index if not exists community_group_members_created_at_idx
  on public.community_group_members (created_at desc);
