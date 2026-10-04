import { Star, Car, Phone } from "lucide-react";
import { usePerson } from "@/lib/rides";

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-warning">
      <Star className="h-3.5 w-3.5 fill-current" />
      {count === 0 ? <span className="text-muted-foreground">New</span> : value.toFixed(1)}
      {count ? <span className="text-muted-foreground"> ({count})</span> : null}
    </span>
  );
}

/** Compact card with a user's name, rating, phone and (for drivers) car details. */
export function PersonCard({ userId, title }: { userId: string; title: string }) {
  const { data } = usePerson(userId);
  if (!data) return <div className="mt-4 h-20 animate-pulse rounded-2xl bg-secondary" />;
  const name = data.profile?.full_name || "User";
  return (
    <div className="mt-4 rounded-2xl bg-secondary p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">{name[0]?.toUpperCase()}</span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{name} <span className="ml-1"><Stars value={data.rating.avg} count={data.rating.count} /></span></p>
          {data.driver && <p className="flex items-center gap-1 text-muted-foreground"><Car className="h-3.5 w-3.5" />{data.driver.car_model || "Car"}</p>}
          {data.profile?.phone && (
            <a href={`tel:${data.profile.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary"><Phone className="h-3.5 w-3.5" />{data.profile.phone}</a>
          )}
        </div>
        {data.driver?.plate && <span className="rounded-md border border-border px-2 py-1 font-mono text-xs">{data.driver.plate}</span>}
      </div>
    </div>
  );
}
