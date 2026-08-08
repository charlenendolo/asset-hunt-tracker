import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-status-defect/25 bg-status-defect/5 px-4 py-6 text-center">
      <p className="text-sm font-medium text-status-defect">Daten konnten nicht geladen werden.</p>
      {message ? <p className="mt-1 text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
