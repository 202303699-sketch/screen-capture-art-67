import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/rides-db";

export function NotificationBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const key = ["notifications", userId];

  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (p) => {
        toast((p.new as { message: string }).message);
        qc.invalidateQueries({ queryKey: ["notifications", userId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const unread = data.filter((n) => !n.read).length;

  const toggle = async () => {
    setOpen(!open);
    if (!open && unread) {
      await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
      qc.invalidateQueries({ queryKey: key });
    }
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} className="relative rounded-full p-2 text-muted-foreground hover:bg-card hover:text-foreground" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <p className="border-b border-border px-4 py-3 text-sm font-semibold">Notifications</p>
          <ul className="max-h-96 overflow-y-auto">
            {data.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet</li>}
            {data.map((n) => (
              <li key={n.id} className="border-b border-border px-4 py-3 text-sm last:border-0">
                <p>{n.message}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
