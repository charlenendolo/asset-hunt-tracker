import { HardHat, MapPin, Truck, Warehouse, Wrench } from "lucide-react";

import { siteTypeLabel } from "@/lib/site-types";
import { cn } from "@/lib/utils";

/**
 * Neutrale Line-Icons je Standorttyp. Bewusst einfarbig (kein Statusfarbcode),
 * damit Standorttyp und Gerätestatus visuell nicht verwechselt werden.
 */
const ICONS = {
  baustelle: HardHat,
  fahrzeug: Truck,
  lager: Warehouse,
  werkstatt: Wrench,
  sonstiges: MapPin,
} as const;

export function SiteTypeIcon({
  type,
  className,
  withTitle = true,
}: {
  type: string | null | undefined;
  className?: string;
  withTitle?: boolean;
}) {
  const Icon = ICONS[(type ?? "sonstiges") as keyof typeof ICONS] ?? MapPin;
  return (
    <Icon
      className={cn("h-4 w-4 shrink-0 text-muted-foreground", className)}
      strokeWidth={1.75}
      aria-hidden={!withTitle}
      {...(withTitle ? { "aria-label": siteTypeLabel(type) } : {})}
    />
  );
}
