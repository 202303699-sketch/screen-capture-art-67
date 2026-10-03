import { Link } from "@tanstack/react-router";
import { Car } from "lucide-react";

const linkCls = "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
const activeCls = "!bg-primary !text-primary-foreground";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Car className="h-5 w-5" />
          </span>
          A&S GO
        </Link>
        <nav className="flex gap-1 rounded-full bg-card p-1">
          <Link to="/passenger" className={linkCls} activeProps={{ className: activeCls }}>Passenger</Link>
          <Link to="/driver" className={linkCls} activeProps={{ className: activeCls }}>Driver</Link>
        </nav>
      </div>
    </header>
  );
}
