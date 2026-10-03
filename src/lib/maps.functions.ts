import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

async function gateway(path: string, init: RequestInit & { fieldMask?: string } = {}) {
  const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
  const GOOGLE_MAPS_API_KEY = process.env["GOOGLE_MAPS_API_KEY"];
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) throw new Error("Google Maps is not configured");
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      "Content-Type": "application/json",
      ...(init.fieldMask ? { "X-Goog-FieldMask": init.fieldMask } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Maps request failed [${res.status}]: ${body}`);
    if (res.status === 403) throw new Error("Google Maps request was denied (403). Check the Maps key restrictions.");
    throw new Error(`Maps request failed [${res.status}]`);
  }
  return res.json();
}

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const placesAutocomplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ input: z.string().trim().min(2).max(120), sessionToken: z.string().uuid(), near: latLng.optional() }).parse(d))
  .handler(async ({ data }) => {
    const json = (await gateway("/places/v1/places:autocomplete", {
      method: "POST",
      fieldMask: "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      body: JSON.stringify({
        input: data.input,
        sessionToken: data.sessionToken,
        locationBias: { circle: { center: { latitude: data.near?.lat ?? 31.2001, longitude: data.near?.lng ?? 29.9187 }, radius: 50000 } },
      }),
    })) as { suggestions?: { placePrediction?: { placeId: string; text: { text: string } } }[] };
    return (json.suggestions ?? [])
      .filter((s) => s.placePrediction)
      .slice(0, 6)
      .map((s) => ({ placeId: s.placePrediction!.placeId, text: s.placePrediction!.text.text }));
  });

export const placeDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ placeId: z.string().min(5).max(300).regex(/^[A-Za-z0-9_-]+$/), sessionToken: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => {
    const qs = data.sessionToken ? `?sessionToken=${data.sessionToken}` : "";
    const json = (await gateway(`/places/v1/places/${data.placeId}${qs}`, { fieldMask: "displayName,formattedAddress,location" })) as {
      displayName?: { text: string };
      formattedAddress?: string;
      location: { latitude: number; longitude: number };
    };
    return {
      name: json.displayName?.text ?? json.formattedAddress ?? "Selected place",
      lat: json.location.latitude,
      lng: json.location.longitude,
    };
  });

export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => latLng.parse(d))
  .handler(async ({ data }) => {
    const json = (await gateway(`/maps/api/geocode/json?latlng=${data.lat},${data.lng}`)) as { results?: { formatted_address: string }[] };
    return { name: json.results?.[0]?.formatted_address ?? `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}` };
  });

export const computeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: latLng, to: latLng }).parse(d))
  .handler(async ({ data }) => {
    const json = (await gateway("/routes/directions/v2:computeRoutes", {
      method: "POST",
      fieldMask: "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: data.from.lat, longitude: data.from.lng } } },
        destination: { location: { latLng: { latitude: data.to.lat, longitude: data.to.lng } } },
        travelMode: "DRIVE",
      }),
    })) as { routes?: { distanceMeters: number; duration: string; polyline: { encodedPolyline: string } }[] };
    const r = json.routes?.[0];
    if (!r) throw new Error("No route found between these places");
    return {
      distanceKm: Math.round(r.distanceMeters / 10) / 100,
      durationMin: Math.max(1, Math.round(parseInt(r.duration) / 60)),
      polyline: r.polyline.encodedPolyline,
    };
  });
