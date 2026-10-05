import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Navigation, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { ACTIVE, NEXT_ACTION, rideActions, useLiveInvalidate, errMsg, type Ride, type Offer } from "@/lib/rides";
import { useShareDriverLocation, navigateUrl } from "@/lib/location";
import { RideMap } from "@/components/maps/RideMap";
import { RideCard } from "@/components/RideCard";
import { PersonCard } from "@/components/PersonCard";
import { RatingForm } from "@/components/RatingForm";
import { RideChat } from "@/components/RideChat";
import { StateBox } from "@/components/StateBox";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({
    meta: [
      { title: "Driver Dashboard — A&S GO" },
      { name: "description", content: "Go online, offer on nearby ride requests and navigate to your passenger." },
      { property: "og:title", content: "Driver Dashboard — A&S GO" },
      { property: "og:description", content: "Go online, offer on ride requests and navigate to passengers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverPage,
});

function DriverPage() {
  const { user, isDriver, roles } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const meKey = ["driver-me", user?.id];
  const mineKey = ["driver-rides", user?.id];

  const me = useQuery({
    queryKey: meKey,
    enabled: !!user && isDriver,
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("*").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });
  useLiveInvalidate("rides", [mineKey], user ? `driver_id=eq.${user.id}` : undefined);
  const mine = useQuery({
    queryKey: mineKey,
    enabled: !!user && isDriver,
    queryFn: async () => {
      const { data, error } = await supabase.from("rides").select("*").eq("driver_id", user!.id).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  const active = mine.data?.find((r) => ACTIVE.includes(r.status));
  const online = !!me.data?.is_online;
  const { pos, denied } = useShareDriverLocation(user?.id, online || !!active);

  if (roles.length && !isDriver) return <main className="mx-auto max-w-xl px-4 py-10"><StateBox>{t("This page is for drivers.")}</StateBox></main>;
  if (me.isLoading || mine.isLoading) return <main className="mx-auto max-w-xl px-4 py-10"><StateBox>{t("Loading…")}</StateBox></main>;
  if (me.error || mine.error) return <main className="mx-auto max-w-xl px-4 py-10"><StateBox tone="error">{errMsg(me.error ?? mine.error)}</StateBox></main>;

  const toggle = async () => {
    const { error } = await supabase.from("driver_profiles").update({ is_online: !online }).eq("user_id", user!.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: meKey });
  };

  const past = (mine.data ?? []).filter((r) => r !== active).slice(0, 12);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{active ? t("Current ride") : t("Available Ride Requests")}</h1>
        <button onClick={toggle} className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold ${online ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
          <span className={`h-2 w-2 rounded-full ${online ? "bg-primary-foreground" : "bg-muted-foreground"}`} />
          {online ? t("Online") : t("Offline")}
        </button>
      </div>
      {(online || active) && (
        <p className={`mb-4 text-xs ${denied ? "text-destructive" : "text-primary"}`}>
          {denied ? t("Location permission denied — passengers can't see you.") : t("Sharing your live location")}
        </p>
      )}
      <Earnings rides={mine.data ?? []} />
      {active ? <ActiveRide ride={active} myPos={pos} /> : online ? <OpenRequests /> : <StateBox>{t("Go online to see requests.")}</StateBox>}
      {past.length > 0 && (
        <>
          <h2 className="mb-4 mt-10 text-2xl font-bold">{t("Previous rides")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((r) => (
              <RideCard key={r.id} ride={r} link>{r.status === "completed" && <RatingForm rideId={r.id} who="passenger" />}</RideCard>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function OpenRequests() {
  const { user } = useAuth();
  const { t } = useT();
  const key = ["open-rides"];
  const offersKey = ["my-offers", user?.id];
  useLiveInvalidate("rides", [key]);
  useLiveInvalidate("ride_offers", [offersKey], user ? `driver_id=eq.${user.id}` : undefined);

  const data = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [r, rej] = await Promise.all([
        supabase.from("rides").select("*").in("status", ["waiting", "offered"]).order("created_at", { ascending: false }).limit(30),
        supabase.from("ride_rejections").select("ride_id").eq("driver_id", user!.id),
      ]);
      if (r.error) throw r.error;
      const hidden = new Set((rej.data ?? []).map((x) => x.ride_id));
      return (r.data ?? []).filter((x) => !hidden.has(x.id) && x.passenger_id !== user!.id);
    },
  });
  const offers = useQuery({
    queryKey: offersKey,
    queryFn: async () => (await supabase.from("ride_offers").select("*").eq("driver_id", user!.id)).data ?? [],
  });

  if (data.isLoading) return <StateBox>{t("Loading…")}</StateBox>;
  if (data.error) return <StateBox tone="error">{errMsg(data.error)}</StateBox>;
  if (!data.data?.length) return <StateBox>{t("No ride requests right now.")}</StateBox>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.data.map((r) => <RequestCard key={r.id} ride={r} myOffer={offers.data?.find((o) => o.ride_id === r.id)} />)}
    </div>
  );
}

function RequestCard({ ride, myOffer }: { ride: Ride; myOffer?: Offer | undefined }) {
  const { user } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(Number(ride.price)));
  const [busy, setBusy] = useState(false);
  const pickup = ride.pickup_lat != null ? { lat: ride.pickup_lat, lng: ride.pickup_lng! } : null;
  const dest = ride.dest_lat != null ? { lat: ride.dest_lat, lng: ride.dest_lng! } : null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["open-rides"] });
      qc.invalidateQueries({ queryKey: ["my-offers"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <RideCard ride={ride}>
      {pickup && <RideMap pickup={pickup} destination={dest} className="mt-4 h-40" />}
      {myOffer?.status === "pending" && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2 text-xs text-primary">
          <span>{t("Offer sent — waiting for passenger")} · {Number(myOffer.price)} EGP</span>
          <button disabled={busy} onClick={() => run(() => rideActions.withdraw(ride.id))} className="font-semibold text-destructive">{t("Withdraw")}</button>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button disabled={busy} onClick={() => run(() => rideActions.offer(ride.id, Number(ride.price)))} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t("Accept")}</button>
        <button disabled={busy} onClick={() => run(() => rideActions.reject(ride.id, user!.id))} className="flex items-center justify-center gap-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4" />{t("Reject")}</button>
      </div>
      <div className="mt-2 flex gap-2">
        <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" aria-label={t("Your offer")} />
        <button disabled={busy || !(Number(price) > 0)} onClick={() => run(() => rideActions.offer(ride.id, Number(price)))} className="flex items-center gap-1 rounded-xl border border-primary px-4 text-sm font-semibold text-primary disabled:opacity-50"><Send className="h-4 w-4" />{t("Offer")}</button>
      </div>
    </RideCard>
  );
}

function ActiveRide({ ride, myPos }: { ride: Ride; myPos: { lat: number; lng: number } | null }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const pickup = ride.pickup_lat != null ? { lat: ride.pickup_lat, lng: ride.pickup_lng! } : null;
  const dest = ride.dest_lat != null ? { lat: ride.dest_lat, lng: ride.dest_lng! } : null;
  const navTo = ride.status === "started" ? dest : pickup;
  const next = NEXT_ACTION[ride.status];

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["driver-rides"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <RideMap pickup={pickup} destination={dest} driver={myPos} className="h-72 md:h-[28rem]" />
      <RideCard ride={ride}>
        <PersonCard userId={ride.passenger_id} title={t("Your passenger")} />
        <RideChat rideId={ride.id} canSend />
        <div className="mt-4 grid gap-2">
          {navTo && (
            <a href={navigateUrl(navTo)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-primary py-2.5 text-sm font-semibold text-primary"><Navigation className="h-4 w-4" />{t("Navigate")}</a>
          )}
          {next && <button disabled={busy} onClick={() => run(() => rideActions.advance(ride.id))} className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">{t(next)}</button>}
          {["accepted", "arriving", "arrived"].includes(ride.status) && (
            <button disabled={busy} onClick={() => run(() => rideActions.cancel(ride.id))} className="rounded-xl border border-border py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10">{t("Cancel")}</button>
          )}
        </div>
      </RideCard>
    </div>
  );
}

function Earnings({ rides }: { rides: Ride[] }) {
  const { t } = useT();
  const done = rides.filter((r) => r.status === "completed");
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = dayStart - 6 * 86400000;
  const sum = (from: number) => done.filter((r) => new Date(r.completed_at ?? r.created_at).getTime() >= from).reduce((a, r) => a + Number(r.price), 0);
  const cards = [
    { label: "Today", value: `${sum(dayStart)} EGP` },
    { label: "Last 7 days", value: `${sum(weekStart)} EGP` },
    { label: "Total earnings", value: `${sum(0)} EGP` },
    { label: "Completed rides", value: String(done.length) },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t(c.label)}</p>
          <p className="mt-1 font-display text-xl font-bold text-primary">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
