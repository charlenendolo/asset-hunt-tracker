import { cn } from "@/lib/utils";
import { machineStatusKey, machineStatusLabel } from "@/lib/status";

const STATUS_CLASSES: Record<string, string> = {
  available: "text-status-available border-status-available/25 bg-status-available/8",
  reserved: "text-status-reserved border-status-reserved/25 bg-status-reserved/8",
  borrowed: "text-status-borrowed border-status-borrowed/25 bg-status-borrowed/8",
  maintenance: "text-status-maintenance border-status-maintenance/25 bg-status-maintenance/8",
  defect: "text-status-defect border-status-defect/25 bg-status-defect/8",
  unknown: "text-muted-foreground border-border bg-muted",
};

export function StatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const key = machineStatusKey(status);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_CLASSES[key],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {machineStatusLabel(status)}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "primary" | "danger" | "warning" | "success";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "text-muted-foreground border-border bg-muted",
    primary: "text-primary border-primary/25 bg-primary/8",
    danger: "text-status-defect border-status-defect/25 bg-status-defect/8",
    warning: "text-status-reserved border-status-reserved/25 bg-status-reserved/8",
    success: "text-status-available border-status-available/25 bg-status-available/8",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
