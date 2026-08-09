import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { getMachineQrUrl } from "@/lib/qr-labels";

/**
 * Vektor-QR (SVG) — bleibt beim Druck in jeder Größe scharf.
 * Fehlerkorrektur "M" plus Quiet Zone von 2 Modulen für Baustellenbedingungen.
 */
export async function machineQrSvg(machineId: string): Promise<string> {
  return QRCode.toString(getMachineQrUrl(machineId), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export function useMachineQrSvgs(machineIds: string[]): {
  svgs: Record<string, string>;
  failed: string[];
  isLoading: boolean;
} {
  const key = machineIds.join(",");
  const [state, setState] = useState<{
    svgs: Record<string, string>;
    failed: string[];
    isLoading: boolean;
  }>({ svgs: {}, failed: [], isLoading: machineIds.length > 0 });

  useEffect(() => {
    let active = true;
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setState({ svgs: {}, failed: [], isLoading: false });
      return;
    }
    setState((s) => ({ ...s, isLoading: true }));
    void (async () => {
      const svgs: Record<string, string> = {};
      const failed: string[] = [];
      for (const id of ids) {
        try {
          svgs[id] = await machineQrSvg(id);
        } catch {
          failed.push(id);
        }
      }
      if (active) setState({ svgs, failed, isLoading: false });
    })();
    return () => {
      active = false;
    };
  }, [key]);

  return state;
}
