import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export function ReportButton({ rideId, reportedUserId }: { rideId: string; reportedUserId: string | null }) {
  const { user } = useAuth();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const r = reason.trim();
    if (r.length < 3) return void toast.error(t("Describe the problem"));
    setBusy(true);
    const { error } = await supabase.from("reports").insert({ reporter_id: user!.id, ride_id: rideId, reported_user_id: reportedUserId, reason: r.slice(0, 1000) });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(t("Report sent"));
    setOpen(false);
    setReason("");
  };

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"><Flag className="h-3.5 w-3.5" />{t("Report a problem")}</button>
    );
  return (
    <div className="mt-3 space-y-2">
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={2} placeholder={t("Describe the problem")} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      <div className="flex gap-2">
        <button disabled={busy} onClick={submit} className="flex-1 rounded-xl bg-destructive py-2 text-sm font-semibold text-destructive-foreground">{t("Send")}</button>
        <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-border py-2 text-sm">{t("Cancel")}</button>
      </div>
    </div>
  );
}
