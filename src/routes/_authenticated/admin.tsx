import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { ACTIVE, errMsg, formatDate, rideActions, useLiveInvalidate } from "@/lib/rides";
import { StatusBadge } from "@/components/RideCard";
import { StateBox } from "@/components/StateBox";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — A&S GO" },
      { name: "description", content: "Manage A&S GO users, drivers, rides, offers, ratings and reports." },
      { property: "og:title", content: "Admin Dashboard — A&S GO" },
      { property: "og:description", content: "Manage A&S GO users, drivers, rides and reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const TABS = ["Overview", "Users", "Drivers", "Rides", "Offers", "Ratings", "Reports"] as const;
type Tab = (typeof TABS)[number];

function useAdminData() {
  return useQuery({
    queryKey: ["admin"],
    queryFn: async () => {
      const [profiles, roles, drivers, rides, offers, ratings, reports] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("driver_profiles").select("*"),
        supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("ride_offers").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("ratings").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      for (const r of [profiles, roles, drivers, rides, offers, ratings, reports]) if (r.error) throw r.error;
      return {
        profiles: profiles.data!, roles: roles.data!, drivers: drivers.data!, rides: rides.data!,
        offers: offers.data!, ratings: ratings.data!, reports: reports.data!,
      };
    },
  });
}

const th = "px-3 py-2 text-start text-xs font-medium text-muted-foreground";
const td = "px-3 py-2 text-sm";
const btn = "rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-secondary disabled:opacity-50";

function AdminPage() {
  const { isAdmin, roles } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Overview");
  const data = useAdminData();
  useLiveInvalidate("rides", [["admin"]]);

  if (roles.length && !isAdmin) return <main className="mx-auto max-w-xl px-4 py-10"><StateBox>{t("Admins only.")}</StateBox></main>;
  if (data.isLoading) return <main className="mx-auto max-w-xl px-4 py-10"><StateBox>{t("Loading…")}</StateBox></main>;
  if (data.error) return <main className="mx-auto max-w-xl px-4 py-10"><StateBox tone="error">{errMsg(data.error)}</StateBox></main>;
  const d = data.data!;
  const name = (id: string | null) => (id && d.profiles.find((p) => p.id === id)?.full_name) || "—";
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const act = async (fn: () => PromiseLike<{ error: unknown } | unknown>) => {
    try {
      const res = (await fn()) as { error?: unknown } | undefined;
      if (res && res.error) throw res.error;
      toast.success(t("Saved"));
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const setSuspended = (id: string, v: boolean) => act(() => supabase.from("profiles").update({ suspended: v }).eq("id", id));

  const done = d.rides.filter((r) => r.status === "completed");
  const stats = [
    ["Users", d.profiles.length], ["Drivers", d.drivers.length], ["Online drivers", d.drivers.filter((x) => x.is_online).length],
    ["Active rides", d.rides.filter((r) => ACTIVE.includes(r.status)).length], ["Completed rides", done.length],
    ["Revenue (EGP)", done.reduce((a, r) => a + Number(r.price), 0)], ["Deliveries", d.rides.filter((r) => r.service_type === "delivery").length],
    ["Open reports", d.reports.filter((r) => r.status === "open").length],
  ] as const;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-3xl font-bold">{t("Admin Dashboard")}</h1>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((x) => (
          <button key={x} onClick={() => setTab(x)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${tab === x ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{t(x)}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{t(l)}</p><p className="mt-1 font-display text-2xl font-bold text-primary">{v}</p></div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {tab === "Users" && (
          <Table head={["Name", "Phone", "Role", "Joined", ""]} empty={!d.profiles.length}>
            {d.profiles.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className={td}>{p.full_name || "—"}{p.suspended && <span className="ms-2 text-xs text-destructive">{t("Suspended")}</span>}</td>
                <td className={td}>{p.phone || "—"}</td>
                <td className={td}>{d.roles.filter((r) => r.user_id === p.id).map((r) => t(r.role)).join(", ")}</td>
                <td className={td}>{formatDate(p.created_at)}</td>
                <td className={td}><button className={btn} onClick={() => setSuspended(p.id, !p.suspended)}>{p.suspended ? t("Restore") : t("Suspend")}</button></td>
              </tr>
            ))}
          </Table>
        )}
        {tab === "Drivers" && (
          <Table head={["Name", "Vehicle", "Status", "Completed rides", "Rating", ""]} empty={!d.drivers.length}>
            {d.drivers.map((dr) => {
              const p = d.profiles.find((x) => x.id === dr.user_id);
              const rs = d.ratings.filter((r) => r.ratee_id === dr.user_id);
              return (
                <tr key={dr.user_id} className="border-t border-border">
                  <td className={td}>{p?.full_name || "—"}{p?.suspended && <span className="ms-2 text-xs text-destructive">{t("Suspended")}</span>}</td>
                  <td className={td}>{dr.car_model} · {dr.plate}</td>
                  <td className={td}>{dr.is_online ? t("Online") : t("Offline")}</td>
                  <td className={td}>{done.filter((r) => r.driver_id === dr.user_id).length}</td>
                  <td className={td}>{rs.length ? (rs.reduce((a, r) => a + r.stars, 0) / rs.length).toFixed(1) + "★" : "—"}</td>
                  <td className={`${td} flex gap-2`}>
                    {dr.is_online && <button className={btn} onClick={() => act(() => supabase.from("driver_profiles").update({ is_online: false }).eq("user_id", dr.user_id))}>{t("Set offline")}</button>}
                    {p && <button className={btn} onClick={() => setSuspended(p.id, !p.suspended)}>{p.suspended ? t("Restore") : t("Suspend")}</button>}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        {tab === "Rides" && (
          <Table head={["Code", "Type", "Passenger", "Driver", "Price", "Status", ""]} empty={!d.rides.length}>
            {d.rides.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className={`${td} font-mono text-xs`}>{r.code}</td>
                <td className={td}>{t(r.service_type === "delivery" ? "Delivery" : "Ride")}</td>
                <td className={td}>{name(r.passenger_id)}</td>
                <td className={td}>{name(r.driver_id)}</td>
                <td className={td}>{Number(r.price)}</td>
                <td className={td}><StatusBadge status={r.status} /></td>
                <td className={td}>{ACTIVE.includes(r.status) && <button className={btn} onClick={() => act(() => rideActions.cancel(r.id))}>{t("Cancel")}</button>}</td>
              </tr>
            ))}
          </Table>
        )}
        {tab === "Offers" && (
          <Table head={["Ride", "Driver", "Price", "Status", "Date"]} empty={!d.offers.length}>
            {d.offers.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className={`${td} font-mono text-xs`}>{d.rides.find((r) => r.id === o.ride_id)?.code ?? "—"}</td>
                <td className={td}>{name(o.driver_id)}</td>
                <td className={td}>{Number(o.price)}</td>
                <td className={td}>{t(o.status)}</td>
                <td className={td}>{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
        {tab === "Ratings" && (
          <Table head={["From", "To", "Stars", "Comment", "Date"]} empty={!d.ratings.length}>
            {d.ratings.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className={td}>{name(r.rater_id)}</td><td className={td}>{name(r.ratee_id)}</td>
                <td className={td}>{r.stars}★</td><td className={td}>{r.comment || "—"}</td><td className={td}>{formatDate(r.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
        {tab === "Reports" && (
          <Table head={["From", "About", "Ride", "Reason", "Status", ""]} empty={!d.reports.length}>
            {d.reports.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className={td}>{name(r.reporter_id)}</td><td className={td}>{name(r.reported_user_id)}</td>
                <td className={`${td} font-mono text-xs`}>{d.rides.find((x) => x.id === r.ride_id)?.code ?? "—"}</td>
                <td className={`${td} max-w-xs whitespace-pre-wrap`}>{r.reason}</td>
                <td className={td}>{t(r.status === "open" ? "Open" : "Resolved")}</td>
                <td className={td}>{r.status === "open" && <button className={btn} onClick={() => act(() => supabase.from("reports").update({ status: "resolved" }).eq("id", r.id))}>{t("Resolve")}</button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </main>
  );
}

function Table({ head, empty, children }: { head: string[]; empty: boolean; children: React.ReactNode }) {
  const { t } = useT();
  if (empty) return <p className="p-6 text-center text-sm text-muted-foreground">{t("Nothing here yet.")}</p>;
  return (
    <table className="w-full min-w-[640px]">
      <thead><tr>{head.map((h, i) => <th key={i} className={th}>{h ? t(h) : ""}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );
}
