export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-primary"
      >
        <span className="block h-3 w-3 rotate-45 rounded-[3px] border-2 border-primary-foreground" />
      </span>
      {!compact ? (
        <span className="min-w-0 truncate text-[15px] font-medium tracking-tight text-foreground">
          Repenning Geräteportal
        </span>
      ) : null}
    </div>
  );
}
