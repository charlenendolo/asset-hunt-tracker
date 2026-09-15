import { cn } from "@/lib/utils";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  site_manager: "Bauleiter",
  warehouse_manager: "Lagerverwalter",
  user: "Mitarbeiter",
};

const ROLE_CLASSES: Record<string, string> = {
  admin:
    "text-role-admin border-role-admin/25 bg-role-admin/8",
  site_manager:
    "text-role-bauleiter border-role-bauleiter/25 bg-role-bauleiter/8",
  warehouse_manager:
    "text-role-lagerverwalter border-role-lagerverwalter/25 bg-role-lagerverwalter/8",
  user:
    "text-role-mitarbeiter border-role-mitarbeiter/25 bg-role-mitarbeiter/8",
};

export function RoleBadge({
  role,
  className,
}: {
  role?: string | null | undefined;
  className?: string | undefined;
}) {
  if (!role) {
    return <span className="text-muted-foreground">–</span>;
  }
  const classes = ROLE_CLASSES[role] ?? "text-muted-foreground border-border bg-muted";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        classes,
        className,
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
