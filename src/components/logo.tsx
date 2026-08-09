import logoAsset from "@/assets/repenning-logo.png.asset.json";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-6",
  md: "h-8",
  lg: "h-14",
  fill: "h-auto w-full max-w-[150px]",
} as const;

/**
 * Zentrale Wortmarke (Repenning Geräteportal). Das Asset enthält bereits den
 * kompletten Schriftzug — daneben darf kein zusätzlicher Text stehen.
 *
 * Das Logo ist für helle Flächen gestaltet und steht deshalb immer auf einer
 * ruhigen hellen Fläche (im Dark Mode als dezente Logo-Karte sichtbar).
 */
export function Logo({
  compact = false,
  size,
  className,
}: {
  /** Kompakte Variante für schmale Sidebar / Mobile-Header. */
  compact?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const height = SIZES[size ?? (compact ? "sm" : "md")];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-white",
        size === "lg" ? "px-5 py-4" : "px-2.5 py-1.5",
        "dark:border dark:border-border",
        className,
      )}
    >
      <img
        src={logoAsset.url}
        alt="Repenning Geräteportal"
        className={cn("object-contain", size === "fill" ? "" : "w-auto max-w-full", height)}
      />
    </span>
  );
}
