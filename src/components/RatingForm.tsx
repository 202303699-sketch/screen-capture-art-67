import { useState } from "react";
import { Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { rideActions, useMyRating, errMsg } from "@/lib/rides";
import { useAuth } from "@/lib/auth";

export function RatingForm({ rideId, who }: { rideId: string; who: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: existing, isLoading } = useMyRating(rideId, user?.id);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) return null;
  if (existing)
    return (
      <p className="mt-4 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
        You rated this {who} {existing.stars}★{existing.comment ? ` — “${existing.comment}”` : ""}
      </p>
    );

  const submit = async () => {
    if (!stars) { toast.error("Pick 1 to 5 stars"); return; }
    setBusy(true);
    try {
      await rideActions.rate(rideId, stars, comment.trim().slice(0, 500));
      toast.success("Thanks for your rating!");
      qc.invalidateQueries({ queryKey: ["my-rating", rideId] });
      qc.invalidateQueries({ queryKey: ["person"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-border p-4">
      <p className="mb-2 text-sm font-medium">Rate your {who}</p>
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} stars`}>
            <Star className={`h-7 w-7 ${n <= stars ? "fill-warning text-warning" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        maxLength={500}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional feedback"
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        rows={2}
      />
      <button onClick={submit} disabled={busy} className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        Submit rating
      </button>
    </div>
  );
}
