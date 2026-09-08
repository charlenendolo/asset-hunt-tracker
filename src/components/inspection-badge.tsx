import { ClipboardCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { inspectionDueState, type InspectionLike } from "@/lib/due-dates";

/**
 * Dezenter Hinweis für den abgeleiteten Zustand „Prüfpflichtig".
 * Der eigentliche Gerätestatus bleibt separat sichtbar.
 */
export function InspectionBadge({
  machine,
  className,
}: {
  machine: InspectionLike;
  className?: string | undefined;
}) {
  const state = inspectionDueState(machine);
  if (!state) return null;
  return (
    <span
      title={state === "today" ? "Prüfung heute fällig" : "Prüfung überfällig"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-status-maintenance/30 bg-status-maintenance/10 px-2 py-0.5 text-xs font-semibold text-status-maintenance",
        className,
      )}
    >
      <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2} />
      Prüfpflichtig
    </span>
  );
}
