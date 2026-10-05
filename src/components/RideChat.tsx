import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useLiveInvalidate, errMsg } from "@/lib/rides";

/** Realtime chat between passenger and driver for one ride. */
export function RideChat({ rideId, canSend }: { rideId: string; canSend: boolean }) {
  const { user } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const key = ["messages", rideId];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useLiveInvalidate("messages", [key], `ride_id=eq.${rideId}`);

  const msgs = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("ride_id", rideId).order("created_at").limit(200);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [msgs.data?.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim().slice(0, 1000);
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({ ride_id: rideId, sender_id: user!.id, body });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    setText("");
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="mt-4 rounded-2xl border border-border">
      <p className="border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("Chat")}</p>
      <div className="max-h-56 space-y-2 overflow-y-auto p-3">
        {msgs.isLoading && <p className="text-center text-xs text-muted-foreground">{t("Loading…")}</p>}
        {msgs.error && <p className="text-center text-xs text-destructive">{errMsg(msgs.error)}</p>}
        {msgs.data?.length === 0 && <p className="text-center text-xs text-muted-foreground">{t("No messages yet")}</p>}
        {msgs.data?.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{m.body}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      {canSend && (
        <form onSubmit={send} className="flex gap-2 border-t border-border p-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={t("Type a message")} className="w-full rounded-xl bg-background px-3 py-2 text-sm outline-none" />
          <button disabled={busy || !text.trim()} className="rounded-xl bg-primary px-3 text-primary-foreground disabled:opacity-50" aria-label={t("Send")}><Send className="h-4 w-4 rtl:-scale-x-100" /></button>
        </form>
      )}
    </div>
  );
}
