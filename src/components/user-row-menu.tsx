import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Mail, MoreVertical, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PasswordChangeDialog, useSendResetLink } from "@/components/password-admin";
import { DeleteUserDialog, EditUserDialog } from "@/components/user-manage";
import { useIdentity } from "@/hooks/use-identity";
import { isPrivilegedTarget } from "@/lib/roles";
import { updateEmployeeAccount } from "@/lib/users.functions";

export type ManagedUser = {
  id: string;
  full_name: string | null;
  username: string | null;
  role: string;
  active: boolean;
  vehicle_site_id?: string | null;
};

/** Alle Zeilenaktionen eines Benutzers in einem Menü — Logik bleibt unverändert. */
export function UserRowMenu({ user, email }: { user: ManagedUser; email: string | null }) {
  const qc = useQueryClient();
  const identity = useIdentity();
  const submit = useServerFn(updateEmployeeAccount);
  const [edit, setEdit] = useState(false);
  const [password, setPassword] = useState(false);
  const [remove, setRemove] = useState(false);
  const sendReset = useSendResetLink(user.id);

  const toggleActive = useMutation({
    mutationFn: async () => submit({ data: { userId: user.id, active: !user.active } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(user.active ? "Benutzer deaktiviert." : "Benutzer aktiviert.");
    },
    onError: (e: Error) => toast.error(e.message || "Änderung fehlgeschlagen."),
  });

  // Administrator- und Superadmin-Zugänge verwaltet ausschließlich der Superadmin.
  const locked = isPrivilegedTarget(user.role) && !identity.isSuperadmin;
  if (locked || identity.userId === user.id) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Aktionen für ${user.full_name ?? "Benutzer"}`}
          >
            <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setEdit(true)}>
            <Pencil className="mr-2 h-4 w-4" strokeWidth={1.75} /> Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPassword(true)}>
            <KeyRound className="mr-2 h-4 w-4" strokeWidth={1.75} /> Passwort ändern
          </DropdownMenuItem>
          {email ? (
            <DropdownMenuItem disabled={sendReset.isPending} onSelect={() => sendReset.mutate()}>
              <Mail className="mr-2 h-4 w-4" strokeWidth={1.75} /> Reset-Link senden
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={toggleActive.isPending}
            onSelect={() => toggleActive.mutate()}
          >
            <Power className="mr-2 h-4 w-4" strokeWidth={1.75} />
            {user.active ? "Deaktivieren" : "Aktivieren"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setRemove(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.75} /> Benutzer löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {edit ? (
        <EditUserDialog user={user} email={email} open={edit} onOpenChange={setEdit} />
      ) : null}
      <PasswordChangeDialog userId={user.id} open={password} onOpenChange={setPassword} />
      {remove ? (
        <DeleteUserDialog
          user={{ id: user.id, full_name: user.full_name }}
          open={remove}
          onOpenChange={setRemove}
        />
      ) : null}
    </>
  );
}
