import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SAFE_PATH = /^\/[A-Za-z0-9\-_/]*$/;

function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_PATH.test(value) && !value.startsWith("//")
    ? value
    : undefined;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const value = safeRedirect(search['redirect']);
    return value ? { redirect: value } : {};
  },
  head: () => ({
    meta: [
      { title: "Anmelden – AssetHunt" },
      {
        name: "description",
        content: "Anmeldung zur AssetHunt Geräte- und Maschinenverwaltung.",
      },
      { property: "og:title", content: "Anmelden – AssetHunt" },
      {
        property: "og:description",
        content: "Anmeldung zur AssetHunt Geräte- und Maschinenverwaltung.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect: returnTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Anmeldung fehlgeschlagen. Bitte prüfe E-Mail und Passwort.");
      return;
    }
    navigate({ href: returnTo ?? "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h1 className="text-xl font-light tracking-tight text-foreground">Anmelden</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wähle deinen Anmeldeweg.
          </p>

          <Tabs defaultValue="pin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pin">Mitarbeiter</TabsTrigger>
              <TabsTrigger value="email">Büro / Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="pin" className="mt-6">
              <PinLoginForm
                onSignedIn={() => navigate({ href: returnTo ?? "/dashboard", replace: true })}
              />
            </TabsContent>

            <TabsContent value="email" className="mt-6">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">
                    E-Mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
            </TabsContent>
          </Tabs>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          AssetHunt · Interne Geräte- und Maschinenverwaltung
        </p>
      </div>
    </div>
  );
}
