/**
 * Les filtres de liste, en formulaire `GET` ordinaire.
 *
 * Aucun JavaScript : le navigateur assemble lui-même l'adresse avec les
 * paramètres, et la page se recharge côté serveur avec les nouveaux
 * filtres. Ça marche avant l'hydratation, ça marche sans JS, et l'état
 * du filtre vit dans l'adresse — donc une recherche se partage et se met
 * en favori.
 *
 * Le bouton est explicite plutôt qu'un envoi automatique au changement :
 * sans JS il faudrait de toute façon un bouton, et deux comportements
 * différents selon l'hydratation sont une mauvaise idée.
 */

const champ =
  "rounded-field border border-fg/20 bg-bg px-3 py-2 font-mono text-small " +
  "text-fg placeholder:text-fg/35 outline-none focus-visible:border-accent/60";

export function Filtres({
  action,
  statuts,
  statutActuel,
  nomRecherche,
  valeurRecherche,
  placeholder,
}: {
  action: string;
  /** Les valeurs de l'enum, telles que l'API les attend. */
  statuts: readonly { valeur: string; libelle: string }[];
  statutActuel?: string;
  /** `search` pour les inscriptions, `reference` pour les paiements. */
  nomRecherche: string;
  valeurRecherche?: string;
  placeholder: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col gap-1">
        <span className="font-mono text-small uppercase tracking-[0.15em] text-fg/45">
          Statut
        </span>
        <select
          name="statut"
          defaultValue={statutActuel ?? ""}
          className={champ}
        >
          <option value="">Tous</option>
          {statuts.map((s) => (
            <option key={s.valeur} value={s.valeur}>
              {s.libelle}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-small uppercase tracking-[0.15em] text-fg/45">
          Recherche
        </span>
        <input
          type="search"
          name={nomRecherche}
          defaultValue={valeurRecherche ?? ""}
          placeholder={placeholder}
          autoCapitalize="none"
          spellCheck={false}
          className={`${champ} w-[clamp(10rem,40vw,18rem)]`}
        />
      </label>

      <button
        type="submit"
        className="rounded-field border border-fg/25 px-4 py-2 font-mono
                   text-small text-fg/80 outline-none focus-visible:border-fg"
      >
        Filtrer
      </button>
    </form>
  );
}
