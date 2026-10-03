import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair, Loader2 } from "lucide-react";
import { placesAutocomplete, placeDetails, reverseGeocode } from "@/lib/maps.functions";
import type { LatLng } from "./RideMap";

export interface Place extends LatLng {
  name: string;
}

interface Props {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  allowCurrent?: boolean;
  active?: boolean;
  onFocus?: () => void;
}

/** Search box with an app-owned suggestion dropdown backed by Places (server-side). */
export function PlaceInput({ label, placeholder, value, onChange, allowCurrent, active, onFocus }: Props) {
  const auto = useServerFn(placesAutocomplete);
  const details = useServerFn(placeDetails);
  const reverse = useServerFn(reverseGeocode);
  const [text, setText] = useState(value?.name ?? "");
  const [items, setItems] = useState<{ placeId: string; text: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const token = useRef(crypto.randomUUID());
  const reqId = useRef(0);

  useEffect(() => setText(value?.name ?? ""), [value?.name]);

  useEffect(() => {
    if (!open || text.trim().length < 2 || text === value?.name) {
      setItems([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await auto({ data: { input: text, sessionToken: token.current } });
        if (id === reqId.current) setItems(res);
      } catch {
        if (id === reqId.current) setItems([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text, open, auto, value?.name]);

  const choose = async (placeId: string) => {
    setBusy(true);
    setOpen(false);
    try {
      const p = await details({ data: { placeId, sessionToken: token.current } });
      onChange(p);
      token.current = crypto.randomUUID();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const useCurrent = () => {
    if (!navigator.geolocation) return setErr("Location is not available on this device");
    setBusy(true);
    setErr("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          const { name } = await reverse({ data: ll });
          onChange({ ...ll, name });
        } catch {
          onChange({ ...ll, name: "Current location" });
        }
        setBusy(false);
      },
      () => {
        setErr("Couldn't get your location. Allow location access and try again.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="relative">
      <span className="mb-1.5 flex items-center justify-between text-sm font-medium">
        {label}
        {active && <span className="text-xs font-normal text-primary">Tap the map to set</span>}
      </span>
      <div className={`flex items-center gap-2 rounded-xl border bg-background px-3 ${active ? "border-primary" : "border-input"}`}>
        <input
          className="w-full bg-transparent py-3 outline-none"
          value={text}
          maxLength={120}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            onFocus?.();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setText(e.target.value);
            if (value) onChange(null);
          }}
        />
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {allowCurrent && (
          <button type="button" onClick={useCurrent} title="Use current location" className="rounded-lg p-1.5 text-primary hover:bg-accent">
            <Crosshair className="h-4 w-4" />
          </button>
        )}
      </div>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
      {open && items.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {items.map((i) => (
            <li key={i.placeId}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i.placeId)} className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent">
                {i.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
