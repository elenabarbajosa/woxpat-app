-- Row-Level Security for public.events, public.registrations, and public.clients
--
-- Summary:
--   - Public (anon) users may only read published events and aggregate registration
--     counts via get_event_registration_counts(). All registration writes go through
--     server routes using the service role key.
--   - Admin users (emails in admin_allowlist, synced from ADMIN_EMAILS on login)
--     may manage events, registrations, and clients from the authenticated admin UI.
--   - Server routes using SUPABASE_SERVICE_ROLE_KEY bypass RLS automatically.
--
-- After applying: ensure each admin email exists in admin_allowlist. Logging in via
-- /api/admin/login auto-syncs allowed emails. Or insert manually:
--   INSERT INTO public.admin_allowlist (email) VALUES ('you@example.com') ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Admin allowlist (mirrors ADMIN_EMAILS env var; populated on admin login)
-- ---------------------------------------------------------------------------

create table if not exists public.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

comment on table public.admin_allowlist is
  'Emails allowed to manage events/registrations/clients via RLS. Synced from ADMIN_EMAILS on admin login.';

alter table public.admin_allowlist enable row level security;
-- No policies: anon/authenticated cannot read or write; service role bypasses RLS.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_allowlist
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

comment on function public.is_admin() is
  'True when the current JWT email is in admin_allowlist. Used by RLS policies for admin UI access.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- Upsert helper for server-side admin login sync (service role only in practice).
create or replace function public.upsert_admin_allowlist_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_email is null or trim(p_email) = '' then
    return;
  end if;
  insert into public.admin_allowlist (email)
  values (lower(trim(p_email)))
  on conflict (email) do nothing;
end;
$$;

revoke all on function public.upsert_admin_allowlist_email(text) from public;
grant execute on function public.upsert_admin_allowlist_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- Public aggregate counts (no PII exposure)
-- ---------------------------------------------------------------------------

create or replace function public.get_event_registration_counts(p_event_id bigint)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'confirmed', coalesce(count(*) filter (where r.status = 'confirmed'), 0),
    'pending', coalesce(count(*) filter (where r.status = 'pending'), 0)
  )
  from public.registrations r
  where r.event_id = p_event_id
    and r.status in ('confirmed', 'pending')
    and exists (
      select 1
      from public.events e
      where e.id = p_event_id
        and e.is_published = true
    );
$$;

comment on function public.get_event_registration_counts(bigint) is
  'Returns confirmed/pending registration counts for a published event. Safe for anon callers.';

revoke all on function public.get_event_registration_counts(bigint) from public;
grant execute on function public.get_event_registration_counts(bigint) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS on core tables
-- ---------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.clients enable row level security;

-- ---------------------------------------------------------------------------
-- events policies
-- ---------------------------------------------------------------------------

-- Public event pages only need published events; unpublished events stay hidden from anon.
create policy "events_select_published"
  on public.events
  for select
  to anon, authenticated
  using (is_published = true);

comment on policy "events_select_published" on public.events is
  'Allow public read of published events for registration pages.';

-- Admin dashboard CRUD (create/edit/delete/duplicate events).
create policy "events_admin_all"
  on public.events
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on policy "events_admin_all" on public.events is
  'Admins in admin_allowlist may manage all events including unpublished drafts.';

-- ---------------------------------------------------------------------------
-- registrations policies
-- ---------------------------------------------------------------------------

-- No anon policies: public registration inserts go through /api/register (service role).
create policy "registrations_admin_all"
  on public.registrations
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on policy "registrations_admin_all" on public.registrations is
  'Admins may view and manage registrations (attendees, cancellations, waitlist).';

-- ---------------------------------------------------------------------------
-- clients policies
-- ---------------------------------------------------------------------------

-- No anon policies: client PII is only written/read via service role or admin UI.
create policy "clients_admin_all"
  on public.clients
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on policy "clients_admin_all" on public.clients is
  'Admins may view client contact details for attendee management.';
