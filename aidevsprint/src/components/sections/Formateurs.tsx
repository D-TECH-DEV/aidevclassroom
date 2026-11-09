"use client";

import Image from "next/image";

import { BadgeSuspendu } from "@/components/formateurs/BadgeSuspendu";
import { FORMATEURS, type Formateur } from "@/lib/formateurs";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Section — les trois intervenants, un par un.
 *
 * Une bande par personne, le badge alternant gauche / droite / gauche,
 * l'explication en face. Pas de rangée de trois cartes identiques, et
 * chaque badge dispose de la moitié de la largeur : de la place pour le
 * tirer sans qu'il sorte de son canvas.
 *
 * ── Sous `lg` ────────────────────────────────────────────────────────
 * Le badge laisse la place à la photo détourée. Arrêté avec Malik le
 * 2026-10-25 : le badge imprime le nom et le rôle sur l'image, et le bloc
 * texte les réécrivait juste en dessous — chaque formateur se présentait
 * deux fois. Le badge occupait en plus 60 % de la largeur et laissait une
 * bande morte à sa droite.
 *
 * Maintenant : portrait à gauche, rôle et nom à sa droite, le reste en
 * pleine largeur dessous. Rien n'est retiré, c'est une réduction — la
 * photo remplace le badge, elle ne le supprime pas.
 *
 * ── Les déclenchements ───────────────────────────────────────────────
 * Rien ne démarre en même temps, c'est la plainte à laquelle cette version
 * répond :
 *
 * 1. Chaque profil a sa propre révélation, au lieu d'une seule pour les
 *    trois. Avant, le bloc entier s'animait quand le premier profil
 *    arrivait — les deux suivants avaient fini d'apparaître bien avant
 *    qu'on les atteigne.
 * 2. Le titre ne se tape plus. La machine à écrire a été retirée le
 *    2026-10-31 à la demande de Malik : la retarder suffisait à ne plus
 *    chevaucher le fondu, mais elle restait instable — elle redémarre à
 *    chaque passage de son observateur, et une phrase qui se réécrit
 *    sous l'œil pendant qu'on lit les profils en dessous est un bug pour
 *    le visiteur, quelle que soit la raison technique. Le titre arrive
 *    maintenant avec la révélation du bloc, comme tous les autres titres
 *    du site.
 * 3. Les trois badges WebGL ne se construisent plus dans la même image :
 *    voir `BadgeSuspendu` et `DELAI_BADGE`.
 *
 * Ce que transmettent Youssouf et Malik vient du brief, mot pour mot.
 * Celui de Victorien n'a jamais été fourni, et aucun des trois n'a donné
 * ses liens. Rien n'est inventé pour autant : **ce qui manque ne se rend
 * pas.** La ligne « ce qu'il transmet » disparaît quand `transmet` vaut
 * `null`, et la ligne de liens n'existe plus du tout — elle n'annonçait
 * que son propre vide. Les trous restent lisibles dans `FORMATEURS`.
 */

/** Écart entre deux montages de canvas WebGL. Voir `BadgeSuspendu`. */
const DELAI_BADGE = 260;

/** Longueur de cordon et balancement propres à chaque badge. */
/* `size` est une fraction du conteneur : au-delà de ~0,7 le badge
   dépasse son canvas et se fait couper, puisque rien ne peut être
   dessiné en dehors. On agrandit le canvas, pas la fraction. */
const SUSPENSIONS = [
  { strapLength: 0.26, size: 0.62, breeze: 0.35 },
  { strapLength: 0.4, size: 0.68, breeze: 0.6 },
  { strapLength: 0.32, size: 0.65, breeze: 0.45 },
];

function Profil({ formateur, index }: { formateur: Formateur; index: number }) {
  const nomComplet = formateur.nom
    ? `${formateur.prenom} ${formateur.nom}`
    : formateur.prenom;
  const badgeADroite = index % 2 === 1;
  const s = SUSPENSIONS[index];

  return (
    // Grille à deux colonnes plutôt qu'une rangée flex : avec `shrink-0`,
    // le badge débordait du conteneur et se faisait couper par le bord.
    // `Reveal` remplace l'`<article>` : un `div` enveloppant de plus aurait
    // cassé la grille de la colonne.
    <Reveal
      as="article"
      className="flex flex-col gap-[clamp(1.5rem,4svh,3rem)]
                 lg:grid lg:grid-cols-2 lg:items-center
                 lg:gap-[clamp(2rem,5vw,5rem)]"
    >
      {/* Desktop : le badge suspendu, saisissable. Il grandit avec l'écran. */}
      <div
        aria-label={`Badge de ${nomComplet}`}
        className={`hidden h-[clamp(24rem,62svh,38rem)] w-full lg:block ${
          badgeADroite ? "lg:order-2" : "lg:order-1"
        }`}
      >
        <BadgeSuspendu
          frontImage={formateur.badge}
          imageFit="cover"
          cardColor="#010F06"
          strapColor="#0A0A0A"
          size={s.size}
          strapLength={s.strapLength}
          breeze={s.breeze}
          delaiMs={index * DELAI_BADGE}
        />
      </div>

      <div
        // Le bloc se colle du côté du badge : sinon, sur la rangée
        // inversée, le texte part à l'opposé et l'écart devient béant.
        className={`flex max-w-[46ch] flex-col gap-4 ${
          badgeADroite
            ? "lg:order-1 lg:justify-self-end"
            : "lg:order-2 lg:justify-self-start"
        }`}
      >
        {/* Sous `lg` : la photo et l'identité sur une rangée, pour occuper
            la largeur au lieu de la laisser vide à droite du portrait.
            À partir de `lg` la photo disparaît — le badge 3D la remplace —
            et le bloc redevient une colonne, comme avant. */}
        <div className="flex items-center gap-[clamp(0.875rem,3vw,1.25rem)] lg:block">
          {/* La photo est détourée sur fond transparent : il lui faut un
              fond à elle, sinon elle flotte sur le noir de la page. */}
          <div
            className="relative size-[clamp(4.5rem,26vw,8rem)] shrink-0
                       overflow-hidden rounded-card border border-accent/30
                       bg-surface lg:hidden"
          >
            <Image
              src={formateur.photo}
              alt={`Portrait de ${nomComplet}`}
              fill
              sizes="26vw"
              className="object-cover object-top"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2 lg:gap-4">
            <p className="font-mono text-small uppercase tracking-[0.25em] text-accent">
              {formateur.role}
            </p>

            <h3 className="text-h2 font-bold leading-[1.05] tracking-tighter">
              {nomComplet}
            </h3>
          </div>
        </div>

        {formateur.transmet && (
          <p className="text-body text-fg/70">{formateur.transmet}</p>
        )}
      </div>
    </Reveal>
  );
}

export function Formateurs() {
  return (
    <section id="formateurs" className="relative py-[clamp(4rem,12svh,9rem)]">
      <div className="shell">
        <Reveal className="flex flex-col items-center text-center">
          <p className="font-mono text-small uppercase tracking-[0.25em] text-accent">
            Les formateurs
          </p>

          <h2 className="mt-4 max-w-[22ch] text-h1 font-bold leading-[1.05] tracking-tighter">
            Un trio complet prêt à vous transmettre notre savoir.
          </h2>
        </Reveal>

        <div className="mt-[clamp(2rem,6svh,4rem)] flex flex-col gap-[clamp(2rem,6svh,4rem)]">
          {FORMATEURS.map((f, i) => (
            <Profil key={f.prenom} formateur={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
