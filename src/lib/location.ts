import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LatLng } from "@/components/maps/RideMap";

/** While enabled, watch the driver's GPS and push it to the database (throttled). */
export function useShareDriverLocation(userId: string | undefined, enabled: boolean) {
  const [pos, setPos] = useState<LatLng | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!enabled || !userId || !navigator.geolocation) return;
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const ll = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(ll);
        setDenied(false);
        const now = Date.now();
        if (now - last < 8000) return;
        last = now;
        supabase.from("driver_profiles").update({ lat: ll.lat, lng: ll.lng, location_updated_at: new Date().toISOString() }).eq("user_id", userId).then();
      },
      (err) => err.code === err.PERMISSION_DENIED && setDenied(true),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [userId, enabled]);

  return { pos, denied };
}

/** Live location of a driver (passenger side), via Realtime + RLS. */
export function useDriverLocation(driverId: string | null | undefined) {
  const [pos, setPos] = useState<LatLng | null>(null);
  useEffect(() => {
    if (!driverId) return;
    supabase.from("driver_profiles").select("lat,lng").eq("user_id", driverId).maybeSingle().then(({ data }) => {
      if (data?.lat != null && data.lng != null) setPos({ lat: data.lat, lng: data.lng });
    });
    const ch = supabase
      .channel(`driver-loc-${driverId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_profiles", filter: `user_id=eq.${driverId}` }, (p) => {
        const n = p.new as { lat: number | null; lng: number | null };
        if (n.lat != null && n.lng != null) setPos({ lat: n.lat, lng: n.lng });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [driverId]);
  return pos;
}

export function navigateUrl(to: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving`;
}
