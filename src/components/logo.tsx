export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-primary"
      >
        <span className="block h-3 w-3 rotate-45 rounded-[3px] border-2 border-primary-foreground" />
      </span>
      {!compact ? (
        <span className="text-[15px] font-medium tracking-tight text-foreground">AssetHunt</span>
      ) : null}
    </div>
  );
}
