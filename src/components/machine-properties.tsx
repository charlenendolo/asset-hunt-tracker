import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { PropertyPicker } from "@/components/property-picker";
import { useIdentity } from "@/hooks/use-identity";
import { setMachineProperties } from "@/lib/machine-properties.functions";
import { machineRelationsQuery } from "@/lib/queries";

export function PropertyTags({ names, limit }: { names: string[]; limit?: number }) {
  if (names.length === 0) return <span className="text-muted-foreground">–</span>;
  const shown = typeof limit === "number" ? names.slice(0, limit) : names;
  const remaining = names.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((name) => (
        <span key={name.toLocaleLowerCase("de-DE")} className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
          {name}
        </span>
      ))}
      {remaining > 0 ? <span className="text-xs text-muted-foreground">+{remaining} weitere</span> : null}
    </span>
  );
}

export function MachineProperties({ machineId }: { machineId: string }) {
  const identity = useIdentity();
  const queryClient = useQueryClient();
  const relations = useQuery(machineRelationsQuery(machineId));
  const save = useServerFn(setMachineProperties);
  const values = (relations.data?.properties ?? []).map((item) => item.name);
  const mutation = useMutation({
    mutationFn: (names: string[]) => save({ data: { machineId, names } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["machine", machineId, "relations"] }),
        queryClient.invalidateQueries({ queryKey: ["machine-properties"] }),
        queryClient.invalidateQueries({ queryKey: ["machines"] }),
      ]);
      toast.success("Eigenschaften gespeichert.");
    },
    onError: (error: Error) => toast.error(error.message || "Eigenschaften konnten nicht gespeichert werden."),
  });

  if (!identity.canManageMachines) return <PropertyTags names={values} />;
  return <PropertyPicker values={values} onChange={(names) => mutation.mutate(names)} />;
}
