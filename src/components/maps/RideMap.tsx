import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "./loader";

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  pickup?: LatLng | null | undefined;
  destination?: LatLng | null | undefined;
  driver?: LatLng | null | undefined;
  polyline?: string | null | undefined;
  onPick?: (p: LatLng) => void;
  className?: string;
}

const DEFAULT_CENTER = { lat: 31.2001, lng: 29.9187 }; // Alexandria

/** Map with pickup (A), destination (B), driver (car) markers and the route line. */
export function RideMap({ pickup, destination, driver, polyline, onPick, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objs = useRef<any[]>([]);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !el.current) return;
        const g = window.google;
        map.current = new g.maps.Map(el.current, {
          center: DEFAULT_CENTER,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });
        map.current.addListener("click", (e: { latLng: { lat: () => number; lng: () => number } }) => {
          pickRef.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        setReady(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    objs.current.forEach((o) => o.setMap(null));
    objs.current = [];
    const bounds = new g.maps.LatLngBounds();
    const add = (pos: LatLng, label: string, color: string) => {
      objs.current.push(
        new g.maps.Marker({
          map: map.current,
          position: pos,
          label: { text: label, color: "#111", fontWeight: "700" },
          icon: { path: g.maps.SymbolPath.CIRCLE, scale: 13, fillColor: color, fillOpacity: 1, strokeColor: "#111", strokeWeight: 2 },
        }),
      );
      bounds.extend(pos);
    };
    if (pickup) add(pickup, "A", "#c6f432");
    if (destination) add(destination, "B", "#6fb6ff");
    if (driver) add(driver, "🚗", "#ffffff");
    if (polyline && g.maps.geometry) {
      const path = g.maps.geometry.encoding.decodePath(polyline);
      objs.current.push(new g.maps.Polyline({ map: map.current, path, strokeColor: "#c6f432", strokeWeight: 5, strokeOpacity: 0.9 }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      path.forEach((p: any) => bounds.extend(p));
    }
    const n = [pickup, destination, driver].filter(Boolean).length;
    if (n > 1 || polyline) map.current.fitBounds(bounds, 48);
    else if (n === 1) {
      map.current.setCenter(bounds.getCenter());
      map.current.setZoom(15);
    }
  }, [ready, pickup?.lat, pickup?.lng, destination?.lat, destination?.lng, driver?.lat, driver?.lng, polyline]);

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-border bg-muted ${className ?? "h-72"}`}>
      <div ref={el} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{error || "Loading map…"}</div>
      )}
    </div>
  );
}
