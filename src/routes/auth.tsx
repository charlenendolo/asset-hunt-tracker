import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PinLoginForm } from "@/components/pin-login-form";
import { passwordLogin } from "@/lib/login.functions";

const SAFE_PATH = /^\/[A-Za-z0-9\-_/]*$/;

function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_PATH.test(value) && !value.startsWith("//")
    ? value
    : undefined;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const value = safeRedirect(search['redirect']);
    return value ? { redirect: value } : {};
  },
  head: () => ({
    meta: [
      { title: "Anmelden – Repenning Geräteportal" },
      {
        name: "description",
        content: "Anmeldung zum Repenning Geräteportal für Maschinen und Geräte.",
      },
      { property: "og:title", content: "Anmelden – Repenning Geräteportal" },
      {
        property: "og:description",
        content: "Anmeldung zum Repenning Geräteportal für Maschinen und Geräte.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect: returnTo } = Route.useSearch();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const login = useServerFn(passwordLogin);

  // Client-only: eine bestehende Session leitet weiter (kein SSR-Zweig -> keine Hydration-Mismatch).
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ href: returnTo ?? "/dashboard", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate, returnTo]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login({ data: { identifier, password } });
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (sessionError) throw new Error("Anmeldung nicht möglich. Bitte erneut versuchen.");
      navigate({ href: returnTo ?? "/dashboard", replace: true });
    } catch (err) {
      setError(
        (err as Error)?.message?.trim() || "Benutzername/E-Mail oder Passwort ist falsch.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h1 className="text-xl font-light tracking-tight text-foreground">Anmelden</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mit Benutzername oder E-Mail-Adresse und Passwort.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-sm font-medium">
                Benutzername oder E-Mail-Adresse
              </Label>
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Passwort
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>

            {error ? (
              <p className="rounded-md border border-status-defect/25 bg-status-defect/5 px-3 py-2 text-sm text-status-defect">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={loading} className="h-11 w-full font-medium">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Anmelden"}
            </Button>
          </form>

        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Interne Geräte- und Maschinenverwaltung
        </p>
      </div>
    </div>
  );
}

