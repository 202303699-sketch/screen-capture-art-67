REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role), public.shares_ride(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role), public.shares_ride(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user(), public.notify_ride(), public.guard_profile_update() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.accept_ride(uuid), public.advance_ride(uuid), public.complete_ride_passenger(uuid), public.cancel_ride(uuid), public.rate_ride(uuid,int,text) FROM anon;