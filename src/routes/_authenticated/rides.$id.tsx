import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { ACTIVE, errMsg, formatDate, useLiveInvalidate } from "@/lib/rides";
import { RideMap } from "@/components/maps/RideMap";
import { RideCard } from "@/components/RideCard";
import { PersonCard } from "@/components/PersonCard";
import { RatingForm } from "@/components/RatingForm";
import { RideChat } from "@/components/RideChat";
import { ReportButton } from "@/components/ReportButton";
import { StateBox } from "@/components/StateBox";

export const Route = createFileRoute("/_authenticated/rides/$id")({
  head: () => ({
    meta: [
      { title: "Ride Details — A&S GO" },
      { name: "description", content: "Details, route, people and ratings for one A&S GO ride." },
      { property: "og:title", content: "Ride Details — A&S GO" },
      { property: "og:description", content: "Details for one A&S GO ride." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RideDetails,
});

function RideDetails() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { t } = useT();
  const key = ["ride", id];
  useLiveInvalidate("rides", [key], `id=eq.${id}`);
  const ride = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("rides").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const ratings = useQuery({
    queryKey: ["ride-ratings", id],
    queryFn: async () => (await supabase.from("ratings").select("*").eq("ride_id", id)).data ?? [],
  });

  if (ride.isLoading) return <main className="mx-auto max-w-3xl px-4 py-10"><StateBox>{t("Loading…")}</StateBox></main>;
  if (ride.error) return <main className="mx-auto max-w-3xl px-4 py-10"><StateBox tone="error">{errMsg(ride.error)}</StateBox></main>;
  const r = ride.data;
  if (!r) return <main className="mx-auto max-w-3xl px-4 py-10"><StateBox>{t("Ride not found or you don't have access.")}</StateBox></main>;

  const isPassenger = r.passenger_id === user?.id;
  const other = isPassenger ? r.driver_id : r.passenger_id;
  const pickup = r.pickup_lat != null ? { lat: r.pickup_lat, lng: r.pickup_lng! } : null;
  const dest = r.dest_lat != null ? { lat: r.dest_lat, lng: r.dest_lng! } : null;

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-2">
      <div>
        <Link to="/history" className="mb-3 inline-block text-sm text-muted-foreground hover:text-primary">← {t("Ride history")}</Link>
        <RideMap pickup={pickup} destination={dest} className="h-64 md:h-96" />
      </div>
      <RideCard ride={r}>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <dt className="text-muted-foreground">{t("Requested")}</dt><dd>{formatDate(r.created_at)}</dd>
          {r.accepted_at && (<><dt className="text-muted-foreground">{t("Driver Accepted")}</dt><dd>{formatDate(r.accepted_at)}</dd></>)}
          {r.started_at && (<><dt className="text-muted-foreground">{t("Trip Started")}</dt><dd>{formatDate(r.started_at)}</dd></>)}
          {r.completed_at && (<><dt className="text-muted-foreground">{t("Trip Completed")}</dt><dd>{formatDate(r.completed_at)}</dd></>)}
        </dl>
        {other && <PersonCard userId={other} title={isPassenger ? t("Your driver") : t("Your passenger")} />}
        {ratings.data?.map((x) => (
          <p key={x.id} className="mt-2 text-xs text-muted-foreground">
            {x.rater_id === user?.id ? t("You rated") : t("You were rated")} {x.stars}★{x.comment ? ` — “${x.comment}”` : ""}
          </p>
        ))}
        {r.status === "completed" && other && <RatingForm rideId={r.id} who={isPassenger ? "driver" : "passenger"} />}
        {r.driver_id && <RideChat rideId={r.id} canSend={ACTIVE.includes(r.status) && r.status !== "waiting" && r.status !== "offered"} />}
        <ReportButton rideId={r.id} reportedUserId={other} />
      </RideCard>
    </main>
  );
}
