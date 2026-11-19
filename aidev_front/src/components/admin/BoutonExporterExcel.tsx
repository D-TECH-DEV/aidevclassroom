"use client";

import { useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon } from "@hugeicons/core-free-icons";

type Props = {
  endpoint: string;
  sprintId?: number;
};

export function BoutonExporterExcel({ endpoint, sprintId }: Props) {
  const searchParams = useSearchParams();

  const buildHref = (format: "xlsx" | "pdf") => {
    const params = new URLSearchParams();
    for (const cle of [
      "statut",
      "status",
      "search",
      "reference",
      "sprintId",
      "enrollmentId",
    ]) {
      const val = searchParams.get(cle);
      if (val) params.set(cle, val);
    }
    if (sprintId !== undefined) {
      params.set("sprintId", String(sprintId));
    }
    params.set("format", format);
    return `${endpoint}?${params.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={buildHref("xlsx")}
        download
        className="inline-flex items-center gap-2 rounded-field border
                   border-accent/45 bg-accent/10 px-4 py-2 font-mono text-small
                   font-semibold text-accent transition-colors outline-none
                   hover:border-accent hover:bg-accent/20 focus-visible:border-fg"
      >
        <HugeiconsIcon icon={Download04Icon} size={15} />
        <span>Excel</span>
      </a>
      <a
        href={buildHref("pdf")}
        download
        className="inline-flex items-center gap-2 rounded-field border
                   border-line-hi bg-surface px-4 py-2 font-mono text-small
                   font-semibold text-fg transition-colors outline-none
                   hover:border-fg hover:bg-surface-2 focus-visible:border-fg"
      >
        <HugeiconsIcon icon={Download04Icon} size={15} />
        <span>PDF</span>
      </a>
    </div>
  );
}
