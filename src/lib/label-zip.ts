import { zipSync, type Zippable } from "fflate";

import { generateMachineQrPng } from "@/hooks/use-machine-qr";
import { renderLabelPng } from "@/lib/label-png";
import { labelFileName, type LabelFormat, type LabelMachine } from "@/lib/qr-labels";

/**
 * Packt vollständige Etiketten-PNGs (nicht nur den QR) in ein ZIP.
 * Dateinamen werden über labelFileName() bereinigt und eindeutig gehalten.
 */
export async function buildLabelZip(
  machines: LabelMachine[],
  format: LabelFormat,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const files: Zippable = {};
  const used = new Set<string>();
  let done = 0;
  for (const machine of machines) {
    const qrPng = await generateMachineQrPng(machine.id);
    const blob = await renderLabelPng(machine, format, qrPng);
    let name = labelFileName(machine, "png");
    let suffix = 2;
    while (used.has(name)) {
      name = labelFileName(machine, "png").replace(/\.png$/, `_${suffix}.png`);
      suffix += 1;
    }
    used.add(name);
    files[name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    done += 1;
    onProgress?.(done, machines.length);
  }
  return new Blob([zipSync(files, { level: 0 })], { type: "application/zip" });
}
