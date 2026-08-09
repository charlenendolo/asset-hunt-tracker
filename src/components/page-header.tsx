import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Kräftigerer Seitenkopf mit Icon-Fläche, Titel, Kurzbeschreibung und
 * Primäraktion. Nutzt ausschließlich Design-Tokens (Jungle Green).
 */
export function PageHeader({
  icon,
  title,
  description,
  actions,
  stats,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  stats?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <section
      className={cn(
        "mb-5 rounded-2xl border border-primary/15 bg-primary/6 px-5 py-5 sm:px-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-medium tracking-tight text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {stats ? <div className="mt-4">{stats}</div> : null}
    </section>
  );
}

/** Kompakte Kennzahl für den Seitenkopf. */
export function HeaderStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "available" | "reserved" | "borrowed" | "maintenance" | "defect";
}) {
  const tones: Record<string, string> = {
    neutral: "text-foreground",
    available: "text-status-available",
    reserved: "text-status-reserved",
    borrowed: "text-status-borrowed",
    maintenance: "text-status-maintenance",
    defect: "text-status-defect",
  };
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-medium", tones[tone])}>{value}</p>
    </div>
  );
}
