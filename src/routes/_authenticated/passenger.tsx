import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Route as RouteIcon, Timer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { ACTIVE, rideActions, useLiveInvalidate, usePerson, errMsg, type Ride, type Offer } from "@/lib/rides";
import { useDriverLocation } from "@/lib/location";
import { computeRoute, reverseGeocode } from "@/lib/maps.functions";
import { RideMap, type LatLng } from "@/components/maps/RideMap";
import { PlaceInput, type Place } from "@/components/maps/PlaceInput";
import { RideCard } from "@/components/RideCard";
import { PersonCard, Stars } from "@/components/PersonCard";
import { RatingForm } from "@/components/RatingForm";
import { RideChat } from "@/components/RideChat";
import { StateBox } from "@/components/StateBox";

export const Route = createFileRoute("/_authenticated/passenger")({
  head: () => ({
    meta: [
      { title: "Request a Ride — A&S GO" },
      { name: "description", content: "Pick your pickup and destination on the map, set your price and track your driver live." },
      { property: "og:title", content: "Request a Ride — A&S GO" },
      { property: "og:description", content: "Pick places on the map, set your price and track your driver live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PassengerPage,
});

function useRoute(from: LatLng | null, to: LatLng | null) {
  const route = useServerFn(computeRoute);
  return useQuery({
    queryKey: ["route", from?.lat, from?.lng, to?.lat, to?.lng],
    enabled: !!from && !!to,
    staleTime: Infinity,
    retry: false,
    queryFn: () => route({ data: { from: from!, to: to! } }),
  });
}

function PassengerPage() {
  const { user, isPassenger, roles } = useAuth();
  const { t } = useT();
  const key = ["my-rides", user?.id];
  useLiveInvalidate("rides", [key], user ? `passenger_id=eq.${user.id}` : undefined);

  const rides = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("rides").select("*").eq("passenger_id", user!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  if (roles.length && !isPassenger) return <main className="mx-auto max-w-xl px-4 py-10"><StateBox>{t("This page is for passengers.")}</StateBox></main>;
  if (rides.isLoading) return <main className="mx-auto max-w-xl px-4 py-10"><StateBox>{t("Loading…")}</StateBox></main>;
  if (rides.error) return <main className="mx-auto max-w-xl px-4 py-10"><StateBox tone="error">{errMsg(rides.error)}</StateBox></main>;

  const list = rides.data ?? [];
  const active = list.find((r) => ACTIVE.includes(r.status));
  const past = list.filter((r) => r !== active);

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[1.2fr_1fr]">
      <section>{active ? <ActiveRide ride={active} /> : <RequestForm />}</section>
      <section>
        <h2 className="mb-4 text-2xl font-bold">{t("Previous rides")}</h2>
        {past.length === 0 ? (
          <StateBox>{t("No rides yet.")}</StateBox>
        ) : (
          <div className="space-y-4">
            {past.map((r) => (
              <RideCard key={r.id} ride={r} link>
                {r.status === "completed" && r.driver_id && <RatingForm rideId={r.id} who="driver" />}
              </RideCard>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function RequestForm() {
  const { user } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const reverse = useServerFn(reverseGeocode);
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dest, setDest] = useState<Place | null>(null);
  const [activeField, setActiveField] = useState<"pickup" | "dest">("pickup");
  const [price, setPrice] = useState("");
  const [service, setService] = useState<"ride" | "delivery">("ride");
  const [pkg, setPkg] = useState("");
  const [recName, setRecName] = useState("");
  const [recPhone, setRecPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const route = useRoute(pickup, dest);

  const onPick = async (ll: LatLng) => {
    let name = `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
    try {
      name = (await reverse({ data: ll })).name;
    } catch { /* keep coordinates as name */ }
    if (activeField === "pickup") {
      setPickup({ ...ll, name });
      if (!dest) setActiveField("dest");
    } else setDest({ ...ll, name });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(price);
    if (!pickup || !dest) return void toast.error("Choose pickup and destination");
    if (!(p > 0 && p < 100000)) return void toast.error("Enter a valid price");
    if (service === "delivery" && (!pkg.trim() || !recName.trim() || !recPhone.trim())) return void toast.error(t("Fill in the package and recipient details"));
    setBusy(true);
    const { error } = await supabase.from("rides").insert({
      passenger_id: user!.id,
      pickup: pickup.name.slice(0, 200),
      destination: dest.name.slice(0, 200),
      pickup_lat: pickup.lat, pickup_lng: pickup.lng,
      dest_lat: dest.lat, dest_lng: dest.lng,
      price: p,
      distance_km: route.data?.distanceKm ?? null,
      duration_min: route.data?.durationMin ?? null,
      service_type: service,
      ...(service === "delivery"
        ? { package_description: pkg.trim().slice(0, 300), recipient_name: recName.trim().slice(0, 100), recipient_phone: recPhone.trim().slice(0, 30) }
        : {}),
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["my-rides"] });
  };

  return (
    <>
      <h1 className="mb-4 text-3xl font-bold md:text-4xl">{t("Request a Ride")}</h1>
      <RideMap pickup={pickup} destination={dest} polyline={route.data?.polyline} onPick={onPick} className="mb-4 h-64 md:h-80" />
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
          {(["ride", "delivery"] as const).map((s) => (
            <button type="button" key={s} onClick={() => setService(s)} className={`rounded-lg py-2 text-sm font-semibold ${service === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t(s === "ride" ? "Ride" : "Delivery")}</button>
          ))}
        </div>
        <PlaceInput label={t("Pickup Location")} placeholder="e.g. Pharos University" value={pickup} onChange={setPickup} allowCurrent active={activeField === "pickup"} onFocus={() => setActiveField("pickup")} />
        <PlaceInput label={t("Destination")} placeholder="e.g. San Stefano" value={dest} onChange={setDest} active={activeField === "dest"} onFocus={() => setActiveField("dest")} />
        {route.isFetching && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />…</p>}
        {route.error && <p className="text-sm text-destructive">{errMsg(route.error)}</p>}
        {route.data && (
          <p className="flex items-center gap-4 rounded-xl bg-secondary px-4 py-3 text-sm">
            <span className="flex items-center gap-1"><RouteIcon className="h-4 w-4 text-primary" />{route.data.distanceKm} km</span>
            <span className="flex items-center gap-1"><Timer className="h-4 w-4 text-primary" />{route.data.durationMin} min</span>
          </p>
        )}
        {service === "delivery" && (
          <div className="space-y-3">
            <input className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary" maxLength={300} value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder={t("What are you sending?")} />
            <div className="grid grid-cols-2 gap-2">
              <input className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary" maxLength={100} value={recName} onChange={(e) => setRecName(e.target.value)} placeholder={t("Recipient name")} />
              <input className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary" maxLength={30} type="tel" value={recPhone} onChange={(e) => setRecPhone(e.target.value)} placeholder={t("Recipient phone")} />
            </div>
          </div>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t("Proposed Price (EGP)")}</span>
          <input className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary" type="number" min={1} value={price} placeholder="150" onChange={(e) => setPrice(e.target.value)} />
        </label>
        <button disabled={busy} className="w-full rounded-xl bg-primary py-4 font-display text-lg font-bold text-primary-foreground transition hover:shadow-glow disabled:opacity-50">
          {t(service === "delivery" ? "Request Delivery" : "Request Ride")}
        </button>
      </form>
    </>
  );
}

function ActiveRide({ ride }: { ride: Ride }) {
  const { t } = useT();
  const qc = useQueryClient();
  const driverPos = useDriverLocation(ride.driver_id && ride.status !== "completed" ? ride.driver_id : null);
  const pickup = ride.pickup_lat != null ? { lat: ride.pickup_lat, lng: ride.pickup_lng! } : null;
  const dest = ride.dest_lat != null ? { lat: ride.dest_lat, lng: ride.dest_lng! } : null;
  const route = useRoute(pickup, dest);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["my-rides"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const open = ride.status === "waiting" || ride.status === "offered";

  return (
    <>
      <h1 className="mb-4 text-3xl font-bold">{t("Current ride")}</h1>
      <RideMap pickup={pickup} destination={dest} driver={driverPos} polyline={route.data?.polyline} className="mb-4 h-64 md:h-80" />
      {driverPos && <p className="mb-3 flex items-center gap-2 text-xs text-primary"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />{t("Driver live location")}</p>}
      <RideCard ride={ride}>
        {open && <OffersList ride={ride} />}
        {ride.driver_id && !open && <PersonCard userId={ride.driver_id} title={t("Your driver")} />}
        {ride.driver_id && !open && <RideChat rideId={ride.id} canSend />}
        <div className="mt-4 flex gap-2">
          {ride.status === "started" && (
            <button disabled={busy} onClick={() => run(() => rideActions.completeByPassenger(ride.id))} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">{t("Complete Ride")}</button>
          )}
          {["waiting", "offered", "accepted", "arriving", "arrived"].includes(ride.status) && (
            <button disabled={busy} onClick={() => run(() => rideActions.cancel(ride.id))} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10">{t("Cancel")}</button>
          )}
        </div>
      </RideCard>
    </>
  );
}

function OffersList({ ride }: { ride: Ride }) {
  const { t } = useT();
  const qc = useQueryClient();
  const key = ["offers", ride.id];
  useLiveInvalidate("ride_offers", [key], `ride_id=eq.${ride.id}`);
  const offers = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("ride_offers").select("*").eq("ride_id", ride.id).eq("status", "pending").order("price");
      if (error) throw error;
      const cutoff = Date.now() - 10 * 60 * 1000;
      return data.filter((o) => new Date(o.created_at).getTime() > cutoff);
    },
    refetchInterval: 30_000,
  });
  const waitedLong = Date.now() - new Date(ride.created_at).getTime() > 10 * 60 * 1000;
  const giveUp = async () => {
    try {
      await rideActions.markNoDriver(ride.id);
      qc.invalidateQueries({ queryKey: ["my-rides"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  useEffect(() => {
    qc.invalidateQueries({ queryKey: key });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride.status]);

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("Driver offers")}</p>
      {offers.isLoading ? (
        <div className="h-16 animate-pulse rounded-2xl bg-secondary" />
      ) : offers.error ? (
        <p className="text-sm text-destructive">{errMsg(offers.error)}</p>
      ) : !offers.data?.length ? (
        <p className="flex items-center gap-2 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("Waiting for drivers to offer…")}</p>
      ) : (
        <ul className="space-y-2">{offers.data.map((o) => <OfferRow key={o.id} offer={o} />)}</ul>
      )}
      {waitedLong && !offers.data?.length && (
        <div className="mt-3 rounded-2xl border border-border p-3 text-sm">
          <p className="mb-2 text-muted-foreground">{t("No driver has offered yet.")}</p>
          <button onClick={giveUp} className="w-full rounded-xl border border-border py-2 font-semibold">{t("Close request — no driver found")}</button>
        </div>
      )}
    </div>
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  const { t } = useT();
  const qc = useQueryClient();
  const { data } = usePerson(offer.driver_id);
  const [busy, setBusy] = useState(false);
  const choose = async () => {
    setBusy(true);
    try {
      await rideActions.selectOffer(offer.id);
      qc.invalidateQueries({ queryKey: ["my-rides"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-semibold">{data?.profile?.full_name || "Driver"} {data && <Stars value={data.rating.avg} count={data.rating.count} />}</p>
        <p className="truncate text-xs text-muted-foreground">{data?.driver?.car_model} · {data?.driver?.plate}</p>
      </div>
      <span className="font-display text-lg font-bold text-primary">{Number(offer.price)} EGP</span>
      <button disabled={busy} onClick={choose} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t("Choose")}</button>
    </li>
  );
}
