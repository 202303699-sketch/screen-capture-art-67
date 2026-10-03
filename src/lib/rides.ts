import { useEffect, useState, useCallback } from "react";

export type RideStatus = "Waiting for Driver" | "Driver Accepted" | "Ride Completed" | "Cancelled";

export interface Driver {
  name: string;
  rating: number;
  car: string;
  plate: string;
}

export interface Ride {
  id: string;
  pickup: string;
  destination: string;
  price: number;
  createdAt: number;
  status: RideStatus;
  driver?: Driver;
  mine?: boolean;
}

const KEY = "ridego.rides";
const REJECTED_KEY = "ridego.rejected";
const EVENT = "ridego:update";

export const DEMO_DRIVER: Driver = { name: "Ahmed", rating: 4.8, car: "Hyundai Elantra", plate: "ABC 1234" };

function seed(): Ride[] {
  const now = Date.now();
  return [
    { id: "AS-1001", pickup: "Pharos University", destination: "San Stefano", price: 120, createdAt: now - 6 * 60000, status: "Waiting for Driver" },
    { id: "AS-1002", pickup: "Alexandria Library", destination: "Smouha", price: 100, createdAt: now - 12 * 60000, status: "Waiting for Driver" },
    { id: "AS-1003", pickup: "Miami", destination: "Sporting", price: 80, createdAt: now - 20 * 60000, status: "Waiting for Driver" },
  ];
}

function read<T>(key: string, fallback: () => T): T {
  const raw = localStorage.getItem(key);
  if (!raw) {
    const v = fallback();
    localStorage.setItem(key, JSON.stringify(v));
    return v;
  }
  try { return JSON.parse(raw) as T; } catch { return fallback(); }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(EVENT));
}

export function useRides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      setRides(read(KEY, seed));
      setRejected(read<string[]>(REJECTED_KEY, () => []));
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((id: string, patch: Partial<Ride>) => {
    write(KEY, read(KEY, seed).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const createRide = useCallback((pickup: string, destination: string, price: number) => {
    const ride: Ride = {
      id: "AS-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
      pickup, destination, price, createdAt: Date.now(), status: "Waiting for Driver", mine: true,
    };
    write(KEY, [ride, ...read(KEY, seed)]);
    return ride;
  }, []);

  const accept = useCallback((id: string) => update(id, { status: "Driver Accepted", driver: DEMO_DRIVER }), [update]);
  const complete = useCallback((id: string) => update(id, { status: "Ride Completed" }), [update]);
  const cancel = useCallback((id: string) => update(id, { status: "Cancelled" }), [update]);
  const reject = useCallback((id: string) => {
    write(REJECTED_KEY, [...read<string[]>(REJECTED_KEY, () => []), id]);
  }, []);
  const reset = useCallback(() => {
    write(KEY, seed());
    write(REJECTED_KEY, []);
  }, []);

  return { rides, rejected, createRide, accept, reject, complete, cancel, reset };
}

export function timeAgo(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
