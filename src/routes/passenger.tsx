import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Star, Car } from "lucide-react";
import { useRides } from "@/lib/rides";
import { RideCard } from "@/components/RideCard";

export const Route = createFileRoute("/passenger")({
  head: () => ({
    meta: [
      { title: "Request a Ride — A&S GO" },
      { name: "description", content: "Enter pickup, destination and your price to request a A&S GO ride." },
      { property: "og:title", content: "Request a Ride — A&S GO" },
      { property: "og:description", content: "Enter pickup, destination and your price to request a ride." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Passenger,
});

const schema = z.object({
  pickup: z.string().trim().min(2, "Enter a pickup location").max(100),
  destination: z.string().trim().min(2, "Enter a destination").max(100),
  price: z.coerce.number().positive("Price must be greater than 0").max(100000),
});

const inputCls = "w-full rounded-xl border border-input bg-background px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

function Passenger() {
  const { rides, createRide, cancel, complete } = useRides();
  const [form, setForm] = useState({ pickup: "", destination: "", price: "" });
  const [error, setError] = useState("");
  const myRides = rides.filter((r) => r.mine);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = schema.safeParse(form);
    if (!res.success) return setError(res.error.issues[0]?.message ?? "Invalid input");
    setError("");
    createRide(res.data.pickup, res.data.destination, res.data.price);
    setForm({ pickup: "", destination: "", price: "" });
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_1.1fr]">
      <section>
        <h1 className="mb-6 text-3xl font-bold md:text-4xl">Request a Ride</h1>
        <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6">
          {(["pickup", "destination"] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1.5 block text-sm font-medium">{k === "pickup" ? "Pickup Location" : "Destination"}</span>
              <input className={inputCls} value={form[k]} maxLength={100}
                placeholder={k === "pickup" ? "e.g. Pharos University" : "e.g. Alexandria"}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Proposed Price (EGP)</span>
            <input className={inputCls} type="number" min={1} value={form.price} placeholder="150"
              onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button className="w-full rounded-xl bg-primary py-4 font-display text-lg font-bold text-primary-foreground transition hover:shadow-glow">
            Request Ride
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold">My Rides</h2>
        {myRides.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">No rides yet. Request one to get started.</p>
        ) : (
          <div className="space-y-4">
            {myRides.map((r) => (
              <RideCard key={r.id} ride={r}>
                {r.status === "Driver Accepted" && r.driver && (
                  <div className="mt-4 flex items-center gap-4 rounded-2xl bg-secondary p-4">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">{r.driver.name[0]}</span>
                    <div className="flex-1 text-sm">
                      <p className="font-semibold">{r.driver.name} <span className="ml-1 inline-flex items-center gap-0.5 text-warning"><Star className="h-3.5 w-3.5 fill-current" />{r.driver.rating}</span></p>
                      <p className="flex items-center gap-1 text-muted-foreground"><Car className="h-3.5 w-3.5" />{r.driver.car}</p>
                    </div>
                    <span className="rounded-md border border-border px-2 py-1 font-mono text-xs">{r.driver.plate}</span>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  {r.status === "Driver Accepted" && (
                    <button onClick={() => complete(r.id)} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Complete Ride</button>
                  )}
                  {(r.status === "Waiting for Driver" || r.status === "Driver Accepted") && (
                    <button onClick={() => cancel(r.id)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10">Cancel</button>
                  )}
                </div>
              </RideCard>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
