-- Event categories (managed in admin UI). Run in Supabase SQL editor or via CLI.
create table if not exists public.event_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.event_categories is 'Admin-managed event categories; events.category stores the category name for compatibility.';

insert into public.event_categories (name, slug, is_active)
values
  ('Breakfast', 'breakfast', true),
  ('Brunch', 'brunch', true),
  ('Workshop', 'workshop', true),
  ('Networking', 'networking', true)
on conflict (name) do nothing;
