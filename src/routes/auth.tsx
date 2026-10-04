import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { User, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Log in or sign up — A&S GO" },
      { name: "description", content: "Create your A&S GO passenger or driver account, or log in." },
      { property: "og:title", content: "Log in or sign up — A&S GO" },
      { property: "og:description", content: "Create your A&S GO passenger or driver account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const base = { email: z.string().trim().email().max(255), password: z.string().min(6).max(72) };
const signupSchema = z.object({
  ...base,
  full_name: z.string().trim().min(2, "Enter your name").max(100),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(["passenger", "driver"]),
  car_model: z.string().trim().max(60).optional(),
  plate: z.string().trim().max(20).optional(),
});

const inputCls = "w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary";

function AuthPage() {
  const { t } = useT();
  const { user, ready, isDriver, roles } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: "", password: "", full_name: "", phone: "", role: "passenger" as "passenger" | "driver", car_model: "", plate: "" });

  useEffect(() => {
    if (ready && user && roles.length) navigate({ to: isDriver ? "/driver" : "/passenger", replace: true });
  }, [ready, user, roles, isDriver, navigate]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const d = z.object(base).parse(f);
        const { error } = await supabase.auth.signInWithPassword(d);
        if (error) throw error;
      } else {
        const d = signupSchema.parse(f);
        if (d.role === "driver" && (!d.car_model || !d.plate)) throw new Error("Enter your car model and plate");
        const { data, error } = await supabase.auth.signUp({
          email: d.email,
          password: d.password,
          options: {
            emailRedirectTo: window.location.origin + "/auth",
            data: { full_name: d.full_name, phone: d.phone, role: d.role, car_model: d.car_model, plate: d.plate },
          },
        });
        if (error) throw error;
        if (!data.session) toast.success(t("Check your email to confirm your account."));
      }
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0]?.message : (err as Error).message;
      toast.error(msg ?? t("Something went wrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-center text-3xl font-bold">{mode === "login" ? t("Log in") : t("Create account")}</h1>
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6">
        {mode === "signup" && (
          <>
            <div>
              <span className="mb-1.5 block text-sm font-medium">{t("I am a")}</span>
              <div className="grid grid-cols-2 gap-2">
                {(["passenger", "driver"] as const).map((r) => (
                  <button type="button" key={r} onClick={() => setF({ ...f, role: r })}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-3 font-semibold ${f.role === r ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
                    {r === "passenger" ? <User className="h-4 w-4" /> : <Car className="h-4 w-4" />}
                    {t(r === "passenger" ? "Passenger" : "Driver")}
                  </button>
                ))}
              </div>
            </div>
            <input className={inputCls} placeholder={t("Full name")} value={f.full_name} onChange={set("full_name")} maxLength={100} />
            <input className={inputCls} placeholder={t("Phone")} value={f.phone} onChange={set("phone")} maxLength={30} type="tel" />
            {f.role === "driver" && (
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder={t("Car model")} value={f.car_model} onChange={set("car_model")} maxLength={60} />
                <input className={inputCls} placeholder={t("Plate number")} value={f.plate} onChange={set("plate")} maxLength={20} />
              </div>
            )}
          </>
        )}
        <input className={inputCls} placeholder={t("Email")} type="email" value={f.email} onChange={set("email")} autoComplete="email" />
        <input className={inputCls} placeholder={t("Password")} type="password" value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        <button disabled={busy} className="w-full rounded-xl bg-primary py-4 font-display text-lg font-bold text-primary-foreground disabled:opacity-50">
          {mode === "login" ? t("Log in") : t("Sign up")}
        </button>
        <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="w-full text-sm text-muted-foreground hover:text-primary">
          {mode === "login" ? `${t("New to A&S GO?")} ${t("Sign up")}` : `${t("Already have an account?")} ${t("Log in")}`}
        </button>
      </form>
    </main>
  );
}
