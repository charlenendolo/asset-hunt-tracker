import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { RoleBadge, ROLE_LABELS } from "@/components/role-badge";
import { Pill } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { profilesQuery } from "@/lib/queries";
import { formatDate, textOrDash } from "@/lib/format";
import { CreateUserDialog } from "@/components/user-admin";
import { UserRowMenu } from "@/components/user-row-menu";
import { useIdentity } from "@/hooks/use-identity";
import { listAccountEmails } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/benutzer")({
  head: () => ({
    meta: [
      { title: "Benutzer – Repenning Geräteportal" },
      { name: "description", content: "Benutzerverwaltung mit Rollen und Status." },
      { property: "og:title", content: "Benutzer – Repenning Geräteportal" },
      { property: "og:description", content: "Benutzerverwaltung mit Rollen und Status." },
    ],
  }),
  component: UsersPage,
});

const ROLE_ORDER: Record<string, number> = {
  admin: 0,
  site_manager: 1,
  warehouse_manager: 2,
  user: 3,
};

type SortKey = "name" | "username" | "email" | "role" | "status" | "created";

function UsersPage() {
  const identity = useIdentity();
  const isAdmin = identity.isAdmin;
  const profiles = useQuery(profilesQuery);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  // Standard: nur aktive Benutzer. Archivierte/gelöschte Zugänge bleiben für die
  // Historie erhalten, erscheinen aber nur über den expliziten Filter.
  const [statusFilter, setStatusFilter] = useState("active");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchEmails = useServerFn(listAccountEmails);
  const emails = useQuery({
    queryKey: ["account-emails"],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => fetchEmails(),
  });
  const emailById = useMemo(
    () => new Map((emails.data ?? []).map((e) => [e.id, e.email])),
    [emails.data],
  );

  const q = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const list = (profiles.data ?? []).filter((p) => {
      if (roleFilter !== "all" && (p.role ?? "user") !== roleFilter) return false;
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      if (!q) return true;
      const mail = (emailById.get(p.id) ?? "").toLowerCase();
      return (
        (p.full_name ?? "").toLowerCase().includes(q) ||
        (p.username ?? "").toLowerCase().includes(q) ||
        mail.includes(q)
      );
    });

    const dir = sortAsc ? 1 : -1;
    const collator = new Intl.Collator("de", { sensitivity: "base" });
    return [...list].sort((a, b) => {
      if (sortKey === "username") return dir * collator.compare(a.username ?? "", b.username ?? "");
      if (sortKey === "email")
        return dir * collator.compare(emailById.get(a.id) ?? "", emailById.get(b.id) ?? "");
      if (sortKey === "role")
        return dir * ((ROLE_ORDER[a.role ?? "user"] ?? 9) - (ROLE_ORDER[b.role ?? "user"] ?? 9));
      if (sortKey === "status") return dir * (Number(b.active) - Number(a.active));
      if (sortKey === "created")
        return (
          dir * (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
        );
      return dir * collator.compare(a.full_name ?? "", b.full_name ?? "");
    });
  }, [profiles.data, roleFilter, statusFilter, q, emailById, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function SortHeader({
    sortId,
    children,
    className,
  }: {
    sortId: SortKey;
    children: React.ReactNode;
    className?: string;
  }) {
    const active = sortKey === sortId;
    return (
      <th className={`px-4 py-3 ${className ?? ""}`}>
        <button
          type="button"
          onClick={() => toggleSort(sortId)}
          className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Nach ${String(children)} sortieren`}
        >
          {children}
          {active ? (
            sortAsc ? (
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
            )
          ) : null}
        </button>
      </th>
    );
  }

  function accessLabel(row: { has_password?: boolean | null }) {
    if (row.has_password) return { text: "Passwort aktiv", tone: "success" as const };
    return { text: "Kein Passwort", tone: "warning" as const };
  }

  return (
    <AppShell
      title="Benutzer"
      description="Rollen und Zugriff im Team"
      actions={isAdmin ? <CreateUserDialog /> : undefined}
    >
      {isAdmin ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            className="h-10 w-full sm:max-w-xs"
            placeholder="Benutzer suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Benutzer suchen"
          />
          <select
            aria-label="Nach Rolle filtern"
            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">Alle Rollen</option>
            <option value="superadmin">{ROLE_LABELS["superadmin"]}</option>
            <option value="admin">{ROLE_LABELS["admin"]}</option>
            <option value="site_manager">{ROLE_LABELS["site_manager"]}</option>
            <option value="warehouse_manager">{ROLE_LABELS["warehouse_manager"]}</option>
            <option value="user">{ROLE_LABELS["user"]}</option>
          </select>
          <select
            aria-label="Nach Status filtern"
            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="active">Nur aktive Benutzer</option>
            <option value="inactive">Archivierte/gelöschte Benutzer</option>
            <option value="all">Alle Benutzer</option>
          </select>
        </div>
      ) : null}

      {profiles.isError ? (
        <ErrorState message={(profiles.error as Error)?.message} />
      ) : profiles.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" strokeWidth={1.5} />}
          title="Keine Benutzer gefunden."
          description="Passe Suche oder Filter an."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <SortHeader sortId="name">Name</SortHeader>
                  {isAdmin ? <SortHeader sortId="username">Benutzername</SortHeader> : null}
                  {isAdmin ? <SortHeader sortId="email">E-Mail</SortHeader> : null}
                  <SortHeader sortId="role">Rolle</SortHeader>
                  {isAdmin ? <th className="px-4 py-3">Zugang</th> : null}
                  <SortHeader sortId="status">Status</SortHeader>
                  <SortHeader sortId="created">Angelegt</SortHeader>
                  {isAdmin ? <th className="w-12 px-4 py-3 text-right">Aktionen</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {textOrDash(p.full_name)}
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {textOrDash(p.username)}
                      </td>
                    ) : null}
                    {isAdmin ? (
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {textOrDash(emailById.get(p.id) ?? null)}
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5">
                      <RoleBadge role={p.role} />
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-2.5">
                        <Pill tone={accessLabel(p).tone}>{accessLabel(p).text}</Pill>
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5">
                      <Pill tone={p.active ? "success" : "neutral"}>
                        {p.active ? "Aktiv" : "Deaktiviert"}
                      </Pill>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatDate(p.created_at)}
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-2.5 text-right">
                        <UserRowMenu
                          user={{
                            id: p.id,
                            full_name: p.full_name,
                            username: p.username ?? null,
                            role: p.role ?? "user",
                            active: p.active ?? true,
                            vehicle_site_id: p.vehicle_site_id ?? null,
                          }}
                          email={emailById.get(p.id) ?? null}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {textOrDash(p.full_name)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {textOrDash(p.username)} · {p.active ? "Aktiv" : "Deaktiviert"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <RoleBadge role={p.role} />
                  {isAdmin ? (
                    <UserRowMenu
                      user={{
                        id: p.id,
                        full_name: p.full_name,
                        username: p.username ?? null,
                        role: p.role ?? "user",
                        active: p.active ?? true,
                        vehicle_site_id: p.vehicle_site_id ?? null,
                      }}
                      email={emailById.get(p.id) ?? null}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
