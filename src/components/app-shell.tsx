import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Container,
  CalendarClock,
  CalendarDays,
  MapPin,
  TriangleAlert,
  Wrench,
  Users,
  QrCode,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ThemeToggleButton } from "@/components/theme-switch";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/maschinen", label: "Geräte", icon: Container },
  { to: "/reservierungen", label: "Reservierungen", icon: CalendarClock },
  { to: "/kalender", label: "Kalender", icon: CalendarDays },
  { to: "/standorte", label: "Standorte", icon: MapPin },
  { to: "/defekte", label: "Defekte", icon: TriangleAlert },
  { to: "/wartung", label: "Wartung", icon: Wrench },
  { to: "/benutzer", label: "Benutzer", icon: Users, adminOnly: true },
  { to: "/etiketten", label: "Etiketten & QR-Codes", icon: QrCode, adminOnly: true },
  { to: "/einstellungen", label: "Einstellungen", icon: Settings },
];

const MOBILE_NAV = NAV.filter((i) =>
  ["/dashboard", "/maschinen", "/reservierungen", "/defekte", "/standorte"].includes(i.to),
);

function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => pathname === to || pathname.startsWith(to + "/");
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const isActive = useIsActive();
  const { isAdmin, role } = useCurrentProfile();
  const personal = role !== "admin" && role !== "site_manager" && role !== "bauleiter";

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (

        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={cn(
            "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(item.to)
              ? "bg-card text-primary shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-border before:absolute before:top-1.5 before:bottom-1.5 before:-left-3 before:w-1 before:rounded-r-full before:bg-primary"
              : "text-foreground/70 hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="truncate">
            {personal && item.to === "/reservierungen" ? "Meine Reservierungen" : item.label}
          </span>
        </Link>
      ))}

    </nav>
  );
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  site_manager: "Bauleiter",
  user: "Mitarbeiter",
};

function UserBlock() {
  const { profile, user, role, isLoading } = useCurrentProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const name = profile?.full_name || user?.email || (isLoading ? "" : "Benutzer");
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border bg-sidebar-accent/40 px-3 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-medium text-primary">
        {initials || "AH"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {isLoading ? "" : (ROLE_LABEL[role] ?? "Mitarbeiter")}
        </p>
      </div>
      <ThemeToggleButton />
      <button
        onClick={handleSignOut}
        aria-label="Abmelden"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isActive = useIsActive();

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Logo size="fill" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Betrieb
          </p>
          <NavLinks />
        </div>
        <UserBlock />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Logo size="fill" />
              <button
                aria-label="Menü schließen"
                onClick={() => setMobileOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
            <UserBlock />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
          <div className="mx-auto grid max-w-[1400px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
            <button
              aria-label="Menü öffnen"
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <div className="col-start-2 min-w-0">
              <h1 className="truncate text-lg font-light tracking-tight text-foreground sm:text-xl">
                {title}
              </h1>
              {description ? (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="col-start-3 shrink-0">{actions}</div> : <div />}
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors",
                isActive(item.to)
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="w-full truncate text-center">
                {(item.label.split(" ")[0] ?? item.label).replace("&", "")}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
