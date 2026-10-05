import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RideStatus = Database["public"]["Enums"]["ride_status"];
export type Ride = Database["public"]["Tables"]["rides"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Offer = Database["public"]["Tables"]["ride_offers"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type DriverProfile = Database["public"]["Tables"]["driver_profiles"]["Row"];

export const STATUS_LABEL: Record<RideStatus, string> = {
  waiting: "Waiting for Driver",
  offered: "Driver Offers",
  accepted: "Driver Accepted",
  arriving: "Driver Arriving",
  arrived: "Driver Arrived",
  started: "Trip Started",
  completed: "Trip Completed",
  cancelled: "Cancelled",
  no_driver: "No Driver Found",
};

export const ACTIVE: RideStatus[] = ["waiting", "offered", "accepted", "arriving", "arrived", "started"];

/** Label of the button a driver presses to move to the next status. */
export const NEXT_ACTION: Partial<Record<RideStatus, string>> = {
  accepted: "On my way",
  arriving: "I've arrived",
  arrived: "Start trip",
  started: "Complete trip",
};

export function timeAgo(ts: string) {
  const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(ts).toLocaleDateString();
}

export function formatDate(ts: string) {
  return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Something went wrong";
}

async function rpc<T>(p: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await p;
  if (error) throw new Error(errMsg(error));
  return data;
}

export const rideActions = {
  offer: (id: string, price: number) => rpc(supabase.rpc("make_offer", { _ride: id, _price: price })),
  selectOffer: (offerId: string) => rpc(supabase.rpc("select_offer", { _offer: offerId })),
  withdraw: (rideId: string) => rpc(supabase.rpc("withdraw_offer", { _ride: rideId })),
  markNoDriver: (rideId: string) => rpc(supabase.rpc("mark_no_driver", { _ride: rideId })),
  advance: (id: string) => rpc(supabase.rpc("advance_ride", { _ride: id })),
  cancel: (id: string) => rpc(supabase.rpc("cancel_ride", { _ride: id })),
  completeByPassenger: (id: string) => rpc(supabase.rpc("complete_ride_passenger", { _ride: id })),
  rate: (id: string, stars: number, comment: string) =>
    rpc(supabase.rpc("rate_ride", { _ride: id, _stars: stars, _comment: comment })),
  reject: async (rideId: string, driverId: string) => {
    const { error } = await supabase.from("ride_rejections").insert({ ride_id: rideId, driver_id: driverId });
    if (error) throw new Error(error.message);
  },
};

/** Subscribe to realtime changes on a table and invalidate the given query keys. */
export function useLiveInvalidate(table: "rides" | "notifications" | "driver_profiles" | "ride_offers" | "messages", keys: unknown[][], filter?: string) {
  const qc = useQueryClient();
  const keyStr = JSON.stringify(keys);
  useEffect(() => {
    const refresh = () => {
      for (const k of JSON.parse(keyStr) as unknown[][]) qc.invalidateQueries({ queryKey: k });
    };
    const channel = supabase
      .channel(`live-${table}-${filter ?? "all"}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, refresh)
      .subscribe((status) => {
        // After a (re)connect or a dropped channel, refetch so nothing is missed.
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") refresh();
      });
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      supabase.removeChannel(channel);
    };
  }, [table, filter, keyStr, qc]);
}

export interface Person {
  profile: Profile | null;
  driver: DriverProfile | null;
  rating: { avg: number; count: number };
}

/** Load profile, driver profile and average rating for a user. */
export async function fetchPerson(userId: string): Promise<Person> {
  const [p, d, r] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("driver_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("ratings").select("stars").eq("ratee_id", userId),
  ]);
  const stars = r.data ?? [];
  const avg = stars.length ? stars.reduce((a, s) => a + s.stars, 0) / stars.length : 0;
  return { profile: p.data, driver: d.data, rating: { avg, count: stars.length } };
}

export function usePerson(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["person", userId],
    queryFn: () => fetchPerson(userId!),
    enabled: !!userId,
  });
}

export function useMyRating(rideId: string, userId: string | undefined) {
  return useQuery({
    queryKey: ["my-rating", rideId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("ratings").select("*").eq("ride_id", rideId).eq("rater_id", userId!).maybeSingle();
      return data;
    },
  });
}

export { errMsg };
