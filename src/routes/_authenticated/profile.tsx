import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { usePerson } from "@/lib/rides";
import { Stars } from "@/components/PersonCard";
import { StateBox } from "@/components/StateBox";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — A&S GO" },
      { name: "description", content: "Edit your A&S GO name, phone and car details." },
      { property: "og:title", content: "My Profile — A&S GO" },
      { property: "og:description", content: "Edit your A&S GO profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const inputCls = "w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary";

function ProfilePage() {
  const { user, isDriver } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const { data, isLoading } = usePerson(user?.id);
  const [f, setF] = useState({ full_name: "", phone: "", car_model: "", plate: "" });

  useEffect(() => {
    if (data) setF({ full_name: data.profile?.full_name ?? "", phone: data.profile?.phone ?? "", car_model: data.driver?.car_model ?? "", plate: data.driver?.plate ?? "" });
  }, [data]);

  if (isLoading) return <main className="mx-auto max-w-md px-4 py-10"><StateBox>{t("Loading…")}</StateBox></main>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.full_name.trim().length < 2) return void toast.error("Enter your name");
    const a = await supabase.from("profiles").update({ full_name: f.full_name.trim().slice(0, 100), phone: f.phone.trim().slice(0, 30) || null }).eq("id", user!.id);
    const b = isDriver ? await supabase.from("driver_profiles").update({ car_model: f.car_model.trim().slice(0, 60), plate: f.plate.trim().slice(0, 20) }).eq("user_id", user!.id) : { error: null };
    if (a.error || b.error) return void toast.error((a.error ?? b.error)!.message);
    toast.success(t("Saved"));
    qc.invalidateQueries({ queryKey: ["person", user!.id] });
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">{t("Profile")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{user?.email} · {data && <Stars value={data.rating.avg} count={data.rating.count} />}</p>
      <form onSubmit={save} className="space-y-4 rounded-3xl border border-border bg-card p-6">
        <input className={inputCls} placeholder={t("Full name")} value={f.full_name} onChange={set("full_name")} maxLength={100} />
        <input className={inputCls} placeholder={t("Phone")} value={f.phone} onChange={set("phone")} maxLength={30} />
        {isDriver && (
          <>
            <input className={inputCls} placeholder={t("Car model")} value={f.car_model} onChange={set("car_model")} maxLength={60} />
            <input className={inputCls} placeholder={t("Plate number")} value={f.plate} onChange={set("plate")} maxLength={20} />
          </>
        )}
        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">{t("Save")}</button>
      </form>
    </main>
  );
}
