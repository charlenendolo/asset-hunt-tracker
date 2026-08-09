import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { overdueLabel, overdueSinceShort } from "@/lib/overdue";

/**
 * Warnhinweis für abgeleitete Überfälligkeit. Der eigentliche Status
 * („Ausgeliehen") bleibt separat sichtbar.
 */
export function OverdueBadge({
  expectedReturnAt,
  variant = "short",
  className,
}: {
  expectedReturnAt?: string | null | undefined;
  variant?: "short" | "full";
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive",
        className,
      )}
    >
      <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2} />
      {variant === "full" ? overdueLabel(expectedReturnAt) : `Überfällig ${overdueSinceShort(expectedReturnAt)}`}
    </span>
  );
}

/** Prominenter Hinweisstreifen, z. B. im Gerätepass oder in „Meine Geräte". */
export function OverdueNotice({
  expectedReturnAt,
  message,
  className,
}: {
  expectedReturnAt?: string | null | undefined;
  message?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-destructive",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0" strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{overdueLabel(expectedReturnAt)}</p>
        {message ? <p className="mt-0.5 text-xs opacity-90">{message}</p> : null}
      </div>
    </div>
  );
}
