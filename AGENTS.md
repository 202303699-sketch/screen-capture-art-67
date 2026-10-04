# AGENTS.md
- Database is the source of truth; ride state changes go only through security-definer RPCs (make_offer, select_offer, advance_ride, cancel_ride, complete_ride_passenger, rate_ride) — keeps transitions and authorization server-side.
- Realtime: components subscribe via `useLiveInvalidate` (src/lib/rides.ts) which invalidates React Query keys; driver GPS via src/lib/location.ts — one pattern for all live data.
- Google Maps: browser key only renders maps (src/components/maps); Places/Geocoding/Routes go through authenticated server fns in src/lib/maps.functions.ts — keeps server key private.
- Signed-in pages live under src/routes/_authenticated/; auth state from `useAuth` (src/lib/auth.tsx).
- UI strings go through `useT()` (src/lib/i18n.tsx) with an Arabic dictionary; layout uses logical/RTL-safe classes.
