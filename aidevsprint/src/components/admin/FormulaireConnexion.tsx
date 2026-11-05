"use client";

import { useActionState } from "react";

import { connexion, type Etat } from "@/app/admin/actions";
import { Alerte } from "./Briques";

/**
 * Le formulaire de connexion.
 *
 * Il n'y a aucun jeton côté client : l'action serveur appelle
 * `POST /auth/login`, range le JWT dans un cookie `httpOnly` et redirige.
 * Le navigateur ne voit jamais passer le jeton.
 *
 * `useActionState` plutôt qu'un `useState` + `fetch` : le formulaire
 * fonctionne même avant l'hydratation, et le `pending` vient de React
 * plutôt que d'un drapeau qu'on oublierait de remettre à zéro.
 */

const INITIAL: Etat = {};

const champ =
  "w-full rounded-field border border-fg/20 bg-bg px-4 py-3 text-body " +
  "text-fg placeholder:text-fg/35 outline-none " +
  "focus-visible:border-accent/60";

export function FormulaireConnexion() {
  const [etat, agir, enCours] = useActionState(connexion, INITIAL);

  return (
    <form action={agir} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="font-mono text-small uppercase tracking-[0.15em] text-fg/55">
          E-mail
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="admin@you-soft.com"
          className={champ}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-mono text-small uppercase tracking-[0.15em] text-fg/55">
          Mot de passe
        </span>
        <input
          type="password"
          name="motDePasse"
          required
          autoComplete="current-password"
          className={champ}
        />
      </label>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

      <button
        type="submit"
        disabled={enCours}
        className="mt-2 rounded-field bg-cta px-6 py-3 text-body font-bold
                   text-fg outline-none focus-visible:border focus-visible:border-fg
                   disabled:opacity-60"
      >
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
