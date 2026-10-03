# A&S GO upgrade plan

This upgrade turns the prototype into a real app with accounts, a shared database, live updates, Google Maps and an admin area. It is large, so it is built in phases. Each phase ends in a working app, and the current request → accept/reject flow keeps working throughout.

## Phase 1 — Branding, accounts, database
- Rename RideGo to **A&S GO** everywhere: logo, header, page titles, landing page, sign-in pages.
- Turn on Lovable Cloud, which provides the database, logins and live updates. No outside accounts are needed.
- Sign up / log in / log out with email and password, choosing **Passenger** or **Driver** at sign-up.
- Profile page: name and phone for everyone. Drivers also get car model, plate and an Online/Offline switch.
- Private pages are locked. Passengers only see their own rides. Drivers see open requests and the rides they accepted.
- Ride data moves from the browser into the database, with the same request → accept/reject flow as today.

## Phase 2 — Full ride lifecycle, live updates, notifications
- Statuses: Waiting for Driver → Driver Accepted → Driver Arriving → Driver Arrived → Trip Started → Trip Completed. A ride can also be Cancelled.
- Drivers move the ride forward with one button per step. Both sides can cancel when allowed.
- Live updates: online drivers see new requests instantly, and passengers see every status change instantly.
- A notification bell with messages such as "New ride request", "Your ride was accepted", "Driver has arrived" and "Trip completed".

## Phase 3 — Google Maps
- Search for places, pick a spot by tapping the map, or use your current location.
- Pickup and destination markers, the route line, distance and estimated time.
- Distance and time are saved with each ride and shown to drivers.
- Live driver location on the passenger's map during a ride, and the passenger's pickup on the driver's map.
- A "Navigate" button that opens Google Maps directions for the driver.
- Uses Lovable's Google Maps connector, so no key goes into the code. I'll show a connect card. Using your own Google key is possible later, and I'll tell you exactly which Google services to enable.

## Phase 4 — Ratings, history, earnings
- After a trip, both sides can give 1–5 stars plus an optional comment. Average ratings show on profiles.
- A Ride History page for passengers and drivers, plus a details page for each ride.
- Driver earnings: today, this week and all-time totals, plus the list of completed trips.

## Phase 5 — Admin dashboard
- Admin-only area. Admin rights are stored securely and checked on the server.
- Stats: total users, passengers, drivers, and active, completed and cancelled rides.
- Lists of users and rides, with simple tools: suspend or restore a user, and cancel a ride.
- I'll explain how to make your own account the first admin.

## Technical details
- Database tables: profiles, user_roles (passenger/driver/admin), driver_profiles, rides, ratings, notifications. Access rules on every table limit users to their own data. Ride updates are only allowed from the assigned driver or the passenger, and only for valid status changes.
- Live updates come from database change subscriptions on rides, notifications and driver location.
- Code is split by area: auth, rides, maps, passenger, driver and admin each get their own folder.
- Every form checks its input. No secret keys are stored in the browser code.

## What you will need to do
- Approve the Lovable Cloud and Google Maps connector cards when they appear.
- Optionally, choose your own admin email.
