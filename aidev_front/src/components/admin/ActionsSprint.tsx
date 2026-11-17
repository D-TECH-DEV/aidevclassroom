"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";

import type { Sprint } from "@/lib/admin/types";
import { ModaleSprint } from "./ModaleSprint";

export function BoutonNouveauSprint() {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-2 rounded-field bg-cta px-5 py-2.5
                   font-bold text-small text-fg transition-opacity outline-none
                   hover:opacity-90 focus-visible:border focus-visible:border-fg"
      >
        <HugeiconsIcon icon={Add01Icon} size={16} />
        <span>Nouveau sprint</span>
      </button>

      {ouvert ? (
        <ModaleSprint
          key="nouveau-sprint"
          ouvert={ouvert}
          onFermer={() => setOuvert(false)}
        />
      ) : null}
    </>
  );
}

export function BoutonModifierSprint({ sprint }: { sprint: Sprint }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1.5 rounded-field border
                   border-fg/25 px-2.5 py-1.5 font-mono text-small text-fg/80
                   transition-colors outline-none hover:border-accent/50
                   hover:text-fg focus-visible:border-fg"
      >
        <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
        <span>Modifier</span>
      </button>

      {ouvert ? (
        <ModaleSprint
          key={`edition-${sprint.id}-${sprint.updatedAt ?? ""}`}
          ouvert={ouvert}
          sprint={sprint}
          onFermer={() => setOuvert(false)}
        />
      ) : null}
    </>
  );
}
