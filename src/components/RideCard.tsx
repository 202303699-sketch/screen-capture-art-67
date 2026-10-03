import type { ReactNode } from "react";
import { MapPin, Flag, Clock } from "lucide-react";
import { type Ride, type RideStatus, timeAgo } from "@/lib/rides";

const statusCls: Record<RideStatus, string> = {
  "Waiting for Driver": "bg-warning/15 text-warning",
  "Driver Accepted": "bg-success/15 text-success",
  "Ride Completed": "bg-info/15 text-info",
  Cancelled: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: RideStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusCls[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function RideCard({ ride, children }: { ride: Ride; children?: ReactNode }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{ride.id}</span>
        <StatusBadge status={ride.status} />
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-4 w-4 text-primary" />
          <div><p className="text-xs text-muted-foreground">Pickup</p><p className="font-medium">{ride.pickup}</p></div>
        </div>
        <div className="flex items-start gap-3">
          <Flag className="mt-0.5 h-4 w-4 text-info" />
          <div><p className="text-xs text-muted-foreground">Destination</p><p className="font-medium">{ride.destination}</p></div>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Proposed Price</p>
          <p className="font-display text-2xl font-bold text-primary">{ride.price} EGP</p>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{timeAgo(ride.createdAt)}</span>
      </div>
      {children}
    </article>
  );
}
