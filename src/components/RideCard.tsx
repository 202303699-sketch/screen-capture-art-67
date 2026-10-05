import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Package, MapPin, Flag, Clock, Route as RouteIcon, Timer } from "lucide-react";
import { useT } from "@/lib/i18n";
import { type Ride, type RideStatus, STATUS_LABEL, timeAgo } from "@/lib/rides";

const statusCls: Record<RideStatus, string> = {
  waiting: "bg-warning/15 text-warning",
  offered: "bg-warning/15 text-warning",
  accepted: "bg-success/15 text-success",
  arriving: "bg-info/15 text-info",
  arrived: "bg-info/15 text-info",
  started: "bg-primary/15 text-primary",
  completed: "bg-secondary text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive",
  no_driver: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: RideStatus }) {
  const { t } = useT();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusCls[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(STATUS_LABEL[status])}
    </span>
  );
}

export function RideCard({ ride, children, link = false }: { ride: Ride; children?: ReactNode; link?: boolean }) {
  const { t } = useT();
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      {ride.service_type === "delivery" && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-info/15 px-3 py-1 text-xs font-semibold text-info"><Package className="h-3.5 w-3.5" />{t("Delivery")}</p>
      )}
      <div className="mb-4 flex items-center justify-between gap-2">
        {link ? (
          <Link to="/rides/$id" params={{ id: ride.id }} className="font-mono text-xs text-muted-foreground hover:text-primary">{ride.code} →</Link>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{ride.code}</span>
        )}
        <StatusBadge status={ride.status} />
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0"><p className="text-xs text-muted-foreground">{t("Pickup")}</p><p className="truncate font-medium">{ride.pickup}</p></div>
        </div>
        <div className="flex items-start gap-3">
          <Flag className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div className="min-w-0"><p className="text-xs text-muted-foreground">{t("Destination")}</p><p className="truncate font-medium">{ride.destination}</p></div>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground">{t("Proposed Price")}</p>
          <p className="font-display text-2xl font-bold text-primary">{Number(ride.price)} EGP</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          {ride.distance_km != null && (
            <span className="flex items-center gap-1"><RouteIcon className="h-3.5 w-3.5" />{Number(ride.distance_km)} km · <Timer className="h-3.5 w-3.5" />{ride.duration_min} min</span>
          )}
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeAgo(ride.created_at)}</span>
        </div>
      </div>
      {ride.service_type === "delivery" && (ride.package_description || ride.recipient_name) && (
        <div className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs">
          {ride.package_description && <p><span className="text-muted-foreground">{t("Package")}: </span>{ride.package_description}</p>}
          {ride.recipient_name && <p><span className="text-muted-foreground">{t("Recipient")}: </span>{ride.recipient_name}{ride.recipient_phone ? ` · ${ride.recipient_phone}` : ""}</p>}
        </div>
      )}
      {children}
    </article>
  );
}
