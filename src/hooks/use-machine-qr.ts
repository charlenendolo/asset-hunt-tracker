import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { getMachineQrUrl } from "@/lib/qr-labels";

/**
 * Verlustfreier Druck-QR als PNG. 512 px entsprechen bei 21 mm Kantenlänge
 * deutlich mehr als 300 DPI; ohne Skalierung oder Screenshot-Rasterisierung.
 */
const qrCache = new Map<string, Promise<string>>();

export async function generateMachineQrPng(machineId: string): Promise<string> {
  const cached = qrCache.get(machineId);
  if (cached) return cached;
  const promise = QRCode.toDataURL(getMachineQrUrl(machineId), {
    type: "image/png",
    width: 512,
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  }).catch((error: unknown) => {
    qrCache.delete(machineId);
    throw error;
  });
  qrCache.set(machineId, promise);
  return promise;
}

export function useMachineQrPngs(machineIds: string[]): {
  pngs: Record<string, string>;
  failed: string[];
  isLoading: boolean;
} {
  const key = machineIds.join(",");
  const [state, setState] = useState<{
    pngs: Record<string, string>;
    failed: string[];
    isLoading: boolean;
  }>({ pngs: {}, failed: [], isLoading: machineIds.length > 0 });

  useEffect(() => {
    let active = true;
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setState({ pngs: {}, failed: [], isLoading: false });
      return;
    }
    setState((s) => ({ ...s, isLoading: true }));
    void (async () => {
      const pngs: Record<string, string> = {};
      const failed: string[] = [];
      for (const id of ids) {
        try {
          pngs[id] = await generateMachineQrPng(id);
        } catch {
          failed.push(id);
        }
      }
      if (active) setState({ pngs, failed, isLoading: false });
    })();
    return () => {
      active = false;
    };
  }, [key]);

  return state;
}
