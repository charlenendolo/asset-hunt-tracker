import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Pill } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { profilesQuery } from "@/lib/queries";
import { formatDate, textOrDash } from "@/lib/format";
import { CreateUserDialog, PinAccessActions, UserRowActions } from "@/components/user-admin";
import { useIdentity } from "@/hooks/use-identity";

export const Route = createFileRoute("/_authenticated/benutzer")({
  head: () => ({
    meta: [
      { title: "Benutzer – AssetHunt" },
      { name: "description", content: "Benutzerverwaltung mit Rollen und Status." },
      { property: "og:title", content: "Benutzer – AssetHunt" },
      { property: "og:description", content: "Benutzerverwaltung mit Rollen und Status." },
    ],
  }),
  component: UsersPage,
});

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  office: "Büro",
  manager: "Bauleiter",
  user: "Mitarbeiter",
};

function roleTone(role: string) {
  if (role === "admin") return "primary" as const;
  if (role === "manager" || role === "office") return "warning" as const;
  return "neutral" as const;
}

function UsersPage() {
  const identity = useIdentity();
  const isAdmin = identity.role === "admin";
  const profiles = useQuery(profilesQuery);
  const rows = profiles.data ?? [];

  return (
    <AppShell
      title="Benutzer"
      description="Rollen und Zugriff im Team"
      actions={isAdmin ? <CreateUserDialog /> : undefined}
    >
      {profiles.isError ? (
        <ErrorState message={(profiles.error as Error)?.message} />
      ) : profiles.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" strokeWidth={1.5} />}
          title="Noch keine Benutzer vorhanden."
          description="Benutzer erscheinen hier, sobald sie sich registriert haben."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Rolle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Angelegt</th>
                  {isAdmin ? <th className="px-4 py-3 text-right">Verwaltung</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {textOrDash(p.full_name)}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={roleTone(p.role)}>{ROLE_LABELS[p.role] ?? p.role}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={p.active ? "success" : "neutral"}>
                        {p.active ? "Aktiv" : "Deaktiviert"}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end gap-2">
                          <UserRowActions user={{ id: p.id, role: p.role, active: p.active }} />
                          <PinAccessActions userId={p.id} />
                        </div>
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
                  <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                </div>
                <Pill tone={roleTone(p.role)}>{ROLE_LABELS[p.role] ?? p.role}</Pill>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
