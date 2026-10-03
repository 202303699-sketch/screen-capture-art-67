/* Loads the Google Maps JavaScript API once (browser only). */
declare global {
  interface Window {
    __asgoMapsReady?: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
  }
}

let promise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (window.google?.maps?.Map) return Promise.resolve();
  if (promise) return promise;
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";
  if (!key) return Promise.reject(new Error("Google Maps key missing"));
  promise = new Promise((resolve, reject) => {
    window.__asgoMapsReady = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=geometry&callback=__asgoMapsReady&channel=${channel}`;
    s.async = true;
    s.onerror = () => {
      promise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(s);
  });
  return promise;
}
