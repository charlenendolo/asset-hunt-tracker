import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { changeOwnPin, pinLogin, searchPinEmployees } from "@/lib/pin-auth.functions";

const GENERIC = "Anmeldung nicht möglich.";

export function PinLoginForm({ onSignedIn }: { onSignedIn: () => void }) {
  const search = useServerFn(searchPinEmployees);
  const login = useServerFn(pinLogin);
  const change = useServerFn(changeOwnPin);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [repeatPin, setRepeatPin] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const trimmed = query.trim();
  // Namen werden ausschließlich geladen, wenn das Dropdown bewusst geöffnet
  // wurde oder mindestens 2 Zeichen getippt sind – nie beim Seitenaufruf.
  const enabled = open && (trimmed.length >= 2 || trimmed.length === 0);
  const employees = useQuery({
    queryKey: ["pin-employees", trimmed],
    enabled,
    staleTime: 30_000,
    queryFn: async () => search({ data: { query: trimmed } }),
  });
  const results = employees.data ?? [];

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!ref || pin.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const result = await login({ data: { ref, pin } });
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (sessionError) throw new Error(GENERIC);
      if (result.mustChangePin) {
        setMustChange(true);
        setBusy(false);
        return;
      }
      onSignedIn();
    } catch {
      setError(GENERIC);
      setPin("");
      setBusy(false);
    }
  }

  async function submitChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPin.length !== 4 || newPin !== repeatPin) {
      setError("Die beiden PINs stimmen nicht überein.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await change({ data: { currentPin: pin, newPin } });
      onSignedIn();
    } catch (err) {
      setError((err as Error).message || "PIN konnte nicht gespeichert werden.");
      setBusy(false);
    }
  }

  if (mustChange) {
    return (
      <form onSubmit={submitChange} className="space-y-4">
        <div>
          <h2 className="text-base font-medium text-foreground">Neuen PIN festlegen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bevor es weitergeht, vergib bitte einen eigenen 4-stelligen PIN.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-pin">Neuer PIN</Label>
          <PinInput id="new-pin" value={newPin} onChange={setNewPin} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="repeat-pin">PIN wiederholen</Label>
          <PinInput id="repeat-pin" value={repeatPin} onChange={setRepeatPin} />
        </div>
        {error ? <ErrorLine>{error}</ErrorLine> : null}
        <Button type="submit" disabled={busy || newPin.length !== 4} className="h-11 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "PIN speichern"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitLogin} className="space-y-4">
      <div className="space-y-1.5" ref={boxRef}>
        <Label htmlFor="pin-search">Mitarbeiter</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="pin-search"
            role="combobox"
            aria-expanded={open}
            aria-controls="pin-employee-list"
            placeholder="Mitarbeiter suchen…"
            className="h-11 pr-10 pl-9"
            value={selectedName ?? query}
            autoComplete="off"
            onChange={(e) => {
              setSelectedName(null);
              setRef(null);
              setQuery(e.target.value);
              setOpen(e.target.value.trim().length >= 2);
            }}
          />
          <button
            type="button"
            aria-label={open ? "Mitarbeiterliste schließen" : "Mitarbeiterliste öffnen"}
            onClick={() => {
              setOpen((prev) => !prev);
              if (selectedName) {
                setSelectedName(null);
                setRef(null);
                setQuery("");
              }
            }}
            className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>

        {open ? (
          <div
            id="pin-employee-list"
            className="max-h-56 overflow-y-auto rounded-md border border-border bg-card shadow-sm"
          >
            {employees.isLoading ? (
              <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Suche läuft…
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Kein Mitarbeiter gefunden.</p>
            ) : (
              <ul className="divide-y divide-border">
                {results.map((row: { ref: string; name: string }) => (
                  <li key={row.ref}>
                    <button
                      type="button"
                      onClick={() => {
                        setRef(row.ref);
                        setSelectedName(row.name);
                        setQuery(row.name);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm",
                        ref === row.ref
                          ? "bg-accent font-medium text-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      {row.name}
                      {ref === row.ref ? <Check className="h-4 w-4 text-primary" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pin">PIN</Label>
        <PinInput id="pin" value={pin} onChange={setPin} />
      </div>

      {error ? <ErrorLine>{error}</ErrorLine> : null}

      <Button type="submit" disabled={busy || !ref || pin.length !== 4} className="h-11 w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Anmelden"}
      </Button>
    </form>
  );
}

function PinInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      placeholder="••••••"
      className="h-11 text-center font-mono text-lg tracking-[0.5em]"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
    />
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-status-defect/25 bg-status-defect/5 px-3 py-2 text-sm text-status-defect">
      {children}
    </p>
  );
}
