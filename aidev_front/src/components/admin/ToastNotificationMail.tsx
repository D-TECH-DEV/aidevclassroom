"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Mail01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import type { NotificationSprintResult } from "@/lib/admin/api";

const EVENT_NAME = "aidev:sprint-mail-toast";

export function emettreToastNotificationMail(
  notification: NotificationSprintResult | null | undefined,
) {
  if (!notification || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NotificationSprintResult>(EVENT_NAME, { detail: notification }),
  );
}

export function ToastNotificationMail() {
  const [notif, setNotif] = useState<NotificationSprintResult | null>(null);
  const [detailsOuverts, setDetailsOuverts] = useState(false);

  useEffect(() => {
    function surNotification(e: Event) {
      const custom = e as CustomEvent<NotificationSprintResult>;
      setNotif(custom.detail);
      setDetailsOuverts(false);
    }
    window.addEventListener(EVENT_NAME, surNotification);
    return () => window.removeEventListener(EVENT_NAME, surNotification);
  }, []);

  if (!notif) return null;

  const total = notif.recipients.length;
  const titre =
    notif.kind === "POSTPONED_OR_SUSPENDED"
      ? "Notification de report / suspension"
      : notif.kind === "SESSION_REACTIVATED"
        ? "Notification d'ouverture / reprise"
        : notif.kind === "SELECTION_SELECTED" ||
            notif.kind === "SELECTION_WAITLIST"
          ? "Notification de sélection"
          : "Notification de mise à jour";

  const resume = notif.queued
    ? "Envoi mis en file d'attente (Redis). Suivez l'avancement dans l'onglet Notification sprint."
    : total === 0
      ? "Aucun inscrit avec acompte payé à notifier."
      : notif.failedCount > 0
        ? `${notif.sentCount} e-mail(s) envoyé(s), ${notif.failedCount} échec(s).`
        : `${notif.sentCount} e-mail(s) envoyé(s) aux inscrits.`;

  return (
    <>
      <div
        role="status"
        className="fixed right-5 bottom-5 z-50 flex w-[min(92vw,26rem)] flex-col gap-3 rounded-card border border-accent/45 bg-surface p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-field border border-accent/35 bg-accent/10 text-accent">
              <HugeiconsIcon icon={Mail01Icon} size={16} />
            </span>
            <div>
              <p className="font-mono text-small font-bold text-fg">{titre}</p>
              <p className="mt-0.5 text-small text-fg/75">{resume}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setNotif(null);
              setDetailsOuverts(false);
            }}
            aria-label="Fermer la notification"
            className="rounded-field border border-fg/15 p-1 text-fg/60 transition-colors hover:border-fg/35 hover:text-fg"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        </div>

        {total > 0 ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDetailsOuverts(true)}
              className="rounded-field border border-accent/50 bg-accent/10 px-3 py-1.5 font-mono text-small font-semibold text-accent transition-colors hover:bg-accent/20"
            >
              Voir les destinataires ({total})
            </button>
          </div>
        ) : null}
      </div>

      {detailsOuverts ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
          onClick={() => setDetailsOuverts(false)}
        >
          <div
            className="flex max-h-[80svh] w-[min(94vw,36rem)] flex-col rounded-card border border-fg/20 bg-surface text-fg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-fg/10 px-5 py-4">
              <div>
                <p className="font-mono text-small uppercase tracking-[0.18em] text-accent">
                  Détail de l&apos;envoi
                </p>
                <h3 className="mt-0.5 text-h3 font-bold text-fg">{titre}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOuverts(false)}
                aria-label="Fermer"
                className="rounded-field border border-fg/15 p-1.5 text-fg/60 hover:border-fg/35 hover:text-fg"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-3 font-mono text-small text-fg/65">{resume}</p>
              <ul className="divide-y divide-fg/10 rounded-field border border-fg/10 bg-bg/40">
                {notif.recipients.map((r) => (
                  <li
                    key={r.email}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-small"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-fg">{r.name}</p>
                      <p className="truncate font-mono text-xs text-fg/60">{r.email}</p>
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
            </div>

            <div className="flex justify-end border-t border-fg/10 px-5 py-3">
              <button
                type="button"
                onClick={() => setDetailsOuverts(false)}
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
