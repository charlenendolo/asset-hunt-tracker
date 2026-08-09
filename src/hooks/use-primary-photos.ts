import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { primaryPhotoUrls } from "@/lib/machine-photos.functions";

/**
 * Hauptbild-URLs (Signed URLs) für Listen und den Gerätepass.
 * Der private Bucket erlaubt Lesen nur angemeldeten Nutzern.
 */
export function usePrimaryPhotos(machineIds: string[], variant: "thumb" | "full" = "thumb") {
  const fetchUrls = useServerFn(primaryPhotoUrls);
  const ids = [...new Set(machineIds)].sort();

  const query = useQuery({
    queryKey: ["machine-primary-photos", variant, ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchUrls({ data: { machineIds: ids, variant } }),
  });

  return (query.data ?? {}) as Record<string, string>;
}
