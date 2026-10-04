import { createFileRoute, Link } from "@tanstack/react-router";
import { User, Car, ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "A&S GO — Simple and flexible ride booking" },
      { name: "description", content: "Request a ride at your own price or pick up passengers as a driver with A&S GO." },
      { property: "og:title", content: "A&S GO — Simple and flexible ride booking" },
      { property: "og:description", content: "Request a ride at your own price or pick up passengers as a driver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function ModeButton({ to, icon, title, text }: { to: "/passenger" | "/driver"; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-glow">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">{icon}</span>
      <span className="flex-1">
        <span className="block font-display text-2xl font-bold">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </span>
      <ArrowRight className="h-6 w-6 text-muted-foreground transition-transform group-hover:translate-x-1 rtl:rotate-180 group-hover:text-primary" />
    </Link>
  );
}

function Index() {
  const { t } = useT();
  return (
    <main className="mx-auto flex max-w-5xl flex-col items-center px-4 py-16 md:py-28">
      <span className="mb-6 rounded-full border border-border px-4 py-1 text-xs font-medium text-muted-foreground">{t("You name the price")}</span>
      <h1 className="text-center text-6xl font-bold tracking-tight md:text-8xl">
        A&amp;S <span className="text-primary">GO</span>
      </h1>
      <p className="mt-4 text-center text-lg text-muted-foreground md:text-xl">{t("Simple and flexible ride booking")}</p>
      <div className="mt-12 grid w-full max-w-3xl gap-4 md:grid-cols-2">
        <ModeButton to="/passenger" icon={<User className="h-7 w-7" />} title={t("Passenger")} text={t("Request a ride, set your price")} />
        <ModeButton to="/driver" icon={<Car className="h-7 w-7" />} title={t("Driver")} text={t("Browse and offer on requests")} />
      </div>
    </main>
  );
}
