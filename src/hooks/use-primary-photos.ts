import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { primaryPhotoUrls } from "@/lib/machine-photos.functions";

/**
 * Hauptbild-Thumbnails (Signed URLs) für Listenansichten.
 * Der private Bucket erlaubt Lesen nur angemeldeten Nutzern.
 */
export function usePrimaryPhotos(machineIds: string[]) {
  const fetchUrls = useServerFn(primaryPhotoUrls);
  const ids = [...new Set(machineIds)].sort();

  const query = useQuery({
    queryKey: ["machine-primary-photos", ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchUrls({ data: { machineIds: ids } }),
  });

  return (query.data ?? {}) as Record<string, string>;
}
