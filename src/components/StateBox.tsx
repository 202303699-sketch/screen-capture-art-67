import type { ReactNode } from "react";

/** Shared empty / loading / error / permission message box. */
export function StateBox({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <div className={`rounded-3xl border border-dashed p-8 text-center ${tone === "error" ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground"}`}>
      {children}
    </div>
  );
}
