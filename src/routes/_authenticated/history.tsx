import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { errMsg, type RideStatus } from "@/lib/rides";
import { RideCard } from "@/components/RideCard";
import { StateBox } from "@/components/StateBox";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Ride History — A&S GO" },
      { name: "description", content: "All your A&S GO rides and deliveries, with status, price and ratings." },
      { property: "og:title", content: "Ride History — A&S GO" },
      { property: "og:description", content: "All your A&S GO rides and deliveries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const FILTERS: { id: string; label: string; statuses: RideStatus[] | null }[] = [
  { id: "all", label: "All", statuses: null },
  { id: "completed", label: "Trip Completed", statuses: ["completed"] },
  { id: "cancelled", label: "Cancelled", statuses: ["cancelled", "no_driver"] },
];

function HistoryPage() {
  const { user } = useAuth();
  const { t } = useT();
  const [filter, setFilter] = useState("all");
  const rides = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .or(`passenger_id.eq.${user!.id},driver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
  const f = FILTERS.find((x) => x.id === filter)!;
  const list = (rides.data ?? []).filter((r) => !f.statuses || f.statuses.includes(r.status));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-3xl font-bold">{t("Ride history")}</h1>
      <div className="mb-6 flex gap-2">
        {FILTERS.map((x) => (
          <button key={x.id} onClick={() => setFilter(x.id)} className={`rounded-full px-4 py-1.5 text-sm ${filter === x.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{t(x.label)}</button>
        ))}
      </div>
      {rides.isLoading ? (
        <StateBox>{t("Loading…")}</StateBox>
      ) : rides.error ? (
        <StateBox tone="error">{errMsg(rides.error)}</StateBox>
      ) : list.length === 0 ? (
        <StateBox>{t("No rides yet.")}</StateBox>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <RideCard key={r.id} ride={r} link>
              <p className="mt-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.passenger_id === user?.id ? t("Passenger") : t("Driver")}</p>
            </RideCard>
          ))}
        </div>
      )}
    </main>
  );
}
