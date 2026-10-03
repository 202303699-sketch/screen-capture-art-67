import { Link } from "@tanstack/react-router";
import { Car, LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "./NotificationBell";

const linkCls = "rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
const activeCls = "!bg-primary !text-primary-foreground";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Car className="h-5 w-5" />
      </span>
      A&amp;S <span className="text-primary">GO</span>
    </Link>
  );
}

export function Header() {
  const { user, isDriver, isPassenger, isAdmin, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Logo />
        {user ? (
          <div className="flex items-center gap-1">
            <nav className="flex gap-1 rounded-full bg-card p-1">
              {isPassenger && <Link to="/passenger" className={linkCls} activeProps={{ className: activeCls }}>Ride</Link>}
              {isDriver && <Link to="/driver" className={linkCls} activeProps={{ className: activeCls }}>Drive</Link>}
              <Link to="/history" className={linkCls} activeProps={{ className: activeCls }}>History</Link>
              {isAdmin && <Link to="/admin" className={linkCls} activeProps={{ className: activeCls }}>Admin</Link>}
            </nav>
            <NotificationBell userId={user.id} />
            <Link to="/profile" className="rounded-full p-2 text-muted-foreground hover:bg-card hover:text-foreground" aria-label="Profile"><User className="h-5 w-5" /></Link>
            <button onClick={signOut} className="rounded-full p-2 text-muted-foreground hover:bg-card hover:text-destructive" aria-label="Log out"><LogOut className="h-5 w-5" /></button>
          </div>
        ) : (
          <Link to="/auth" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Log in</Link>
        )}
      </div>
    </header>
  );
}
