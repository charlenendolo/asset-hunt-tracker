import logoAsset from "@/assets/repenning-logo.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Zentrale Wortmarke (Repenning Geräteportal). Das Asset enthält bereits den
 * kompletten Schriftzug — daneben darf kein zusätzlicher Text stehen.
 *
 * Das Logo ist für helle Flächen gestaltet, deshalb steht es immer auf einer
 * ruhigen hellen Logo-Fläche (im Dark Mode als dezente Karte sichtbar).
 */
export function Logo({
  compact = false,
  className,
}: {
  /** Kompakte Variante für schmale Sidebar / Mobile-Header. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-white px-2.5 py-1.5 dark:border dark:border-border",
        className,
      )}
    >
      <img
        src={logoAsset.url}
        alt="Repenning Geräteportal"
        className={cn("w-auto object-contain", compact ? "h-6" : "h-8")}
      />
    </span>
  );
}
