"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Mail01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import type { SprintNotificationItem } from "@/lib/admin/api";
import { date } from "@/lib/admin/types";
import { Cadre, Cellule, Ligne, Pagination, Tableau, Vide } from "./Briques";

const LIBELLE_TYPE: Record<SprintNotificationItem["kind"], string> = {
  SCHEDULE_OR_LOCATION_UPDATED: "Mise à jour date / lieu",
  PRICE_UPDATED: "Mise à jour tarifaire",
  POSTPONED_OR_SUSPENDED: "Report / suspension",
  SESSION_REACTIVATED: "Ouverture / reprise",
  SELECTION_SELECTED: "Sélection — Retenus",
  SELECTION_WAITLIST: "Sélection — Liste d'attente",
};

export function ListeNotificationsSprint({
  items,
  total,
  page,
  limit,
}: {
  items: SprintNotificationItem[];
  total: number;
  page: number;
  limit: number;
}) {
  const [selection, setSelection] = useState<SprintNotificationItem | null>(null);
  const [onglet, setOnglet] = useState<"contenu" | "destinataires">("contenu");

  function ouvrirDetail(item: SprintNotificationItem) {
    setSelection(item);
    setOnglet(item.htmlContent ? "contenu" : "destinataires");
  }

  return (
    <>
      <div className="mt-6">
        <Cadre
          titre={`${total} notification${total > 1 ? "s" : ""} envoyée${total > 1 ? "s" : ""}`}
        >
          {items.length ? (
            <>
              <Tableau
                entetes={[
                  "Date",
                  "Sprint",
                  "Type",
                  "Note",
                  "Envois",
                  "Destinataires",
                ]}
              >
                {items.map((n) => {
                  const nbDest = Array.isArray(n.recipients)
                    ? n.recipients.length
                    : 0;
                  return (
                    <Ligne key={n.id}>
                      <Cellule mono>{date(n.createdAt)}</Cellule>
                      <Cellule>
                        <p className="font-semibold text-fg">{n.sprint.name}</p>
                      </Cellule>
                      <Cellule>
                        <span className="rounded-pill border border-fg/20 bg-bg/60 px-2.5 py-0.5 font-mono text-xs text-fg/85">
                          {LIBELLE_TYPE[n.kind]}
                        </span>
                      </Cellule>
                      <Cellule>
                        <span className="text-small text-fg/70">
                          {n.note ? n.note : "—"}
                        </span>
                      </Cellule>
                      <Cellule mono>
                        <span className="text-accent">
                          {n.sentCount}
                          {n.totalRecipients > 0 ? ` / ${n.totalRecipients}` : ""} envoyé(s)
                        </span>
                        {n.status && n.status !== "COMPLETED" ? (
                          <span className="ml-2 rounded-pill border border-fg/20 px-2 py-0.5 text-[0.7rem] text-fg/75">
                            {n.status === "QUEUED" ? "En file" : "En cours"}
                          </span>
                        ) : null}
                        {n.failedCount > 0 ? (
                          <span className="ml-2 text-fg/60">
                            · {n.failedCount} échec(s)
                          </span>
                        ) : null}
                      </Cellule>
                      <Cellule>
                        <button
                          type="button"
                          onClick={() => ouvrirDetail(n)}
                          className="inline-flex items-center gap-1.5 rounded-field border border-accent/45 bg-accent/10 px-3 py-1 font-mono text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
                        >
                          <HugeiconsIcon icon={Mail01Icon} size={13} />
                          <span>Voir ({nbDest})</span>
                        </button>
                      </Cellule>
                    </Ligne>
                  );
                })}
              </Tableau>

              <Pagination
                base="/admin/sprints"
                page={page}
                limit={limit}
                total={total}
                parametres={{ vue: "notifications" }}
              />
            </>
          ) : (
            <Vide>Aucune notification envoyée pour le moment.</Vide>
          )}
        </Cadre>
      </div>

      {selection ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
          onClick={() => setSelection(null)}
        >
          <div
            className="flex max-h-[80svh] w-[min(94vw,36rem)] flex-col rounded-card border border-fg/20 bg-surface text-fg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-fg/10 px-5 py-4">
              <div>
                <p className="font-mono text-small uppercase tracking-[0.18em] text-accent">
                  {LIBELLE_TYPE[selection.kind]}
                </p>
                <h3 className="mt-0.5 text-h3 font-bold text-fg">
                  {selection.sprint.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelection(null)}
                aria-label="Fermer"
                className="rounded-field border border-fg/15 p-1.5 text-fg/60 hover:border-fg/35 hover:text-fg"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-fg/10 px-5 py-2.5">
              <button
                type="button"
                onClick={() => setOnglet("contenu")}
                className={`rounded-field border px-3 py-1 font-mono text-xs transition-colors ${
                  onglet === "contenu"
                    ? "border-accent/60 bg-accent/15 font-semibold text-accent"
                    : "border-fg/15 text-fg/65 hover:border-fg/35 hover:text-fg"
                }`}
              >
                Contenu du mail
              </button>
              <button
                type="button"
                onClick={() => setOnglet("destinataires")}
                className={`rounded-field border px-3 py-1 font-mono text-xs transition-colors ${
                  onglet === "destinataires"
                    ? "border-accent/60 bg-accent/15 font-semibold text-accent"
                    : "border-fg/15 text-fg/65 hover:border-fg/35 hover:text-fg"
                }`}
              >
                Destinataires ({selection.recipients.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {onglet === "contenu" ? (
                <div className="flex flex-col gap-3">
                  {selection.subject ? (
                    <div className="rounded-field border border-fg/15 bg-bg/50 px-3.5 py-2 font-mono text-xs text-fg/80">
                      <span className="text-fg/50">Objet : </span>
                      <span className="font-semibold text-fg">{selection.subject}</span>
                    </div>
                  ) : null}
                  {selection.htmlContent ? (
                    <iframe
                      srcDoc={selection.htmlContent}
                      sandbox=""
                      title="Aperçu du contenu de l'e-mail"
                      className="h-[26rem] w-full rounded-field border border-fg/15 bg-white"
                    />
                  ) : (
                    <p className="font-mono text-small text-fg/60">
                      Contenu HTML non enregistré pour cet envoi antérieur.
                      {selection.note ? ` Note : ${selection.note}` : ""}
                    </p>
                  )}
                </div>
              ) : selection.recipients.length ? (
                <ul className="divide-y divide-fg/10 rounded-field border border-fg/10 bg-bg/40">
                  {selection.recipients.map((r) => (
                    <li
                      key={r.email}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-small"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-fg">{r.name}</p>
                        <p className="truncate font-mono text-xs text-fg/60">
                          {r.email}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-pill border px-2.5 py-0.5 font-mono text-xs ${
                          r.sent
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : "border-fg/20 bg-fg/5 text-fg/65"
                        }`}
                      >
                        {r.sent ? <HugeiconsIcon icon={Tick02Icon} size={12} /> : null}
                        <span>{r.sent ? "Envoyé" : "Échec"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-small text-fg/60">
                  Aucun inscrit avec acompte payé sur cette session au moment de l&apos;envoi.
                </p>
              )}
            </div>

            <div className="flex justify-end border-t border-fg/10 px-5 py-3">
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="rounded-field border border-fg/20 px-4 py-1.5 font-mono text-small text-fg/80 hover:border-fg/40 hover:text-fg"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
