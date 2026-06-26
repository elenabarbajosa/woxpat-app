-- One active registration per client per event.
-- Cancelled rows are excluded so a cancelled attendee can re-register via UPDATE
-- (reactivation) without violating uniqueness. Also blocks duplicate active rows
-- from race conditions on concurrent public registration.

create unique index if not exists registrations_client_event_active_uidx
  on public.registrations (client_id, event_id)
  where status in ('confirmed', 'pending', 'pending_payment', 'waitlist');

comment on index public.registrations_client_event_active_uidx is
  'At most one active registration per client per event; cancelled rows may coexist until reactivated.';
