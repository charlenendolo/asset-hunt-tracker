import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { changeOwnPin, listPinEmployees, pinLogin } from "@/lib/pin-auth.functions";

const GENERIC = "Anmeldung nicht möglich.";

export function PinLoginForm({ onSignedIn }: { onSignedIn: () => void }) {
  const list = useServerFn(listPinEmployees);
  const login = useServerFn(pinLogin);
  const change = useServerFn(changeOwnPin);

  const employees = useQuery({
    queryKey: ["pin-employees"],
    staleTime: 60_000,
    queryFn: async () => list(),
  });

  const [search, setSearch] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [repeatPin, setRepeatPin] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const rows = employees.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [employees.data, search]);

  const selectedName = (employees.data ?? []).find((r) => r.ref === ref)?.name;

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
    if (newPin.length !== 6 || newPin !== repeatPin) {
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
        <Button type="submit" disabled={busy || newPin.length !== 6} className="h-11 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "PIN speichern"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitLogin} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pin-search">Mitarbeiter</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="pin-search"
            placeholder="Name suchen"
            className="h-11 pl-9"
            value={search}
            autoComplete="off"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {employees.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-md border border-border">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Keine Auswahl verfügbar.</p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((row) => (
                  <li key={row.ref}>
                    <button
                      type="button"
                      onClick={() => setRef(row.ref)}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm",
                        ref === row.ref
                          ? "bg-primary/5 font-medium text-foreground"
                          : "text-foreground hover:bg-muted/60",
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
        )}
        {selectedName ? (
          <p className="text-xs text-muted-foreground">Ausgewählt: {selectedName}</p>
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
