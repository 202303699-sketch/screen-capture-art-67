import { createFileRoute } from "@tanstack/react-router";
import { Check, X, RotateCcw } from "lucide-react";
import { useRides } from "@/lib/rides";
import { RideCard } from "@/components/RideCard";

export const Route = createFileRoute("/driver")({
  head: () => ({
    meta: [
      { title: "Available Ride Requests — RideGo Driver" },
      { name: "description", content: "See nearby ride requests with passenger-proposed prices and accept or reject them." },
      { property: "og:title", content: "Available Ride Requests — RideGo Driver" },
      { property: "og:description", content: "Accept or reject ride requests as a RideGo driver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Driver,
});

function Driver() {
  const { rides, rejected, accept, reject, reset } = useRides();
  const available = rides.filter((r) => r.status === "Waiting for Driver" && !rejected.includes(r.id));
  const accepted = rides.filter((r) => r.status === "Driver Accepted");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold md:text-4xl">Available Ride Requests</h1>
        <button onClick={reset} title="Reset demo data" className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-3.5 w-3.5" /> Reset demo
        </button>
      </div>
      {available.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">No ride requests right now.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((r) => (
            <RideCard key={r.id} ride={r}>
              <div className="mt-4 flex gap-2">
                <button onClick={() => accept(r.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:shadow-glow">
                  <Check className="h-4 w-4" /> Accept
                </button>
                <button onClick={() => reject(r.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-destructive/10 hover:text-destructive">
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            </RideCard>
          ))}
        </div>
      )}
      {accepted.length > 0 && (
        <>
          <h2 className="mb-4 mt-12 text-2xl font-bold">My Accepted Rides</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accepted.map((r) => <RideCard key={r.id} ride={r} />)}
          </div>
        </>
      )}
    </main>
  );
}
