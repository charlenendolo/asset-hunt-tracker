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
import { listAccountEmails } from "@/lib/users.functions";
import { listPinAccess } from "@/lib/pin-auth.functions";
import { useServerFn } from "@tanstack/react-start";

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

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  site_manager: "Bauleiter",
  user: "Mitarbeiter",
};

function roleTone(role: string) {
  if (role === "admin") return "primary" as const;
  if (role === "site_manager") return "warning" as const;
  return "neutral" as const;
}

function UsersPage() {
  const identity = useIdentity();
  const isAdmin = identity.role === "admin";
  const profiles = useQuery(profilesQuery);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const fetchEmails = useServerFn(listAccountEmails);
  const emails = useQuery({
    queryKey: ["account-emails"],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => fetchEmails(),
  });
  const emailById = new Map((emails.data ?? []).map((e) => [e.id, e.email]));
  const fetchPinAccess = useServerFn(listPinAccess);
  const pinAccess = useQuery({
    queryKey: ["pin-access"],
    enabled: isAdmin,
    staleTime: 30_000,
    queryFn: async () => fetchPinAccess(),
  });
  const pinById = new Map((pinAccess.data ?? []).map((p) => [p.user_id, p.enabled]));

  const q = search.trim().toLowerCase();
  const rows = (profiles.data ?? []).filter((p) => {
    if (roleFilter !== "all" && (p.role ?? "user") !== roleFilter) return false;
    if (statusFilter === "active" && !p.active) return false;
    if (statusFilter === "inactive" && p.active) return false;
    if (!q) return true;
    const mail = (emailById.get(p.id) ?? "").toLowerCase();
    return (p.full_name ?? "").toLowerCase().includes(q) || mail.includes(q);
  });

  function accessLabel(id: string) {
    const hasEmail = !!emailById.get(id);
    const pin = pinById.get(id);
    if (hasEmail && pin) return { text: "E-Mail aktiv · PIN aktiv", tone: "success" as const };
    if (hasEmail && pin === false) return { text: "E-Mail aktiv · PIN deaktiviert", tone: "success" as const };
    if (hasEmail) return { text: "E-Mail", tone: "success" as const };
    if (pin) return { text: "PIN", tone: "neutral" as const };
    return { text: "Kein Zugang", tone: "warning" as const };
  }

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
                  {isAdmin ? <th className="px-4 py-3">E-Mail</th> : null}
                  {isAdmin ? <th className="px-4 py-3">Zugang</th> : null}
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
                      {p.role ? (
                        <Pill tone={roleTone(p.role)}>{ROLE_LABELS[p.role] ?? p.role}</Pill>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3 text-muted-foreground">
                        {emailById.get(p.id) ? (
                          emailById.get(p.id)
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>
                    ) : null}
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <Pill tone={accessLabel(p.id).tone}>{accessLabel(p.id).text}</Pill>
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <Pill tone={p.active ? "success" : "neutral"}>
                        {p.active ? "Aktiv" : "Deaktiviert"}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end gap-2">
                          <UserRowActions
                            user={{ id: p.id, role: p.role ?? "user", active: p.active ?? true }}
                            email={emailById.get(p.id) ?? null}
                            pinEnabled={pinById.get(p.id) ?? false}
                          />
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
                {p.role ? (
                  <Pill tone={roleTone(p.role)}>{ROLE_LABELS[p.role] ?? p.role}</Pill>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
