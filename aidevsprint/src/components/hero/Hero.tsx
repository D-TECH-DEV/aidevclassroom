import Aurora from "@/components/backgrounds/Aurora";
import { CarteInfos } from "./CarteInfos";
import { BoutonReserver } from "@/components/inscription/BoutonReserver";
import { CountdownFlip } from "./CountdownFlip";
import { ModulesProgramme } from "./ModulesProgramme";
import { SeatsGauge } from "./SeatsGauge";
import type { Edition } from "@/lib/edition";

/**
 * Hero — direction C : le compte à rebours EST le hero.
 *
 * Pas un panneau d'informations. Les chiffres, la phrase, ce qu'on vend
 * et où, puis l'action. Rien d'autre : le prix et le niveau vivent plus bas.
 *
 * La ligne « Formation · durée · lieu » a été ajoutée le 2026-10-19 : la
 * page ne disait nulle part qu'il s'agissait d'une formation. Un visiteur
 * voyait un compte à rebours et une promesse, sans savoir ce qu'on lui
 * vendait. Elle est passée sous le titre le même jour : au-dessus des
 * chiffres, elle tombait derrière la capsule de la navbar. Le 2026-10-20
 * elle est devenue `CarteInfos` — en texte courant, ces trois faits se
 * lisaient comme une légende plutôt que comme l'offre.
 */
export function Hero({ edition }: { edition: Edition | null }) {
  return (
    <section className="relative isolate flex min-h-svh flex-col overflow-hidden">
      {/* Aurora — React Bits. La profondeur vient de la lumière,
          jamais d'une ombre. Réglages sobres : le fond ne doit pas
          disputer la vedette aux chiffres. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <Aurora
          // Les trois arrêts du dégradé signature : son vert de départ,
          // son bleu d'arrivée, et la teinte de bascule du milieu. Les
          // couleurs d'origine de React Bits (violet + vert acide) sont
          // parties le 2026-10-28 — c'était exactement le dégradé
          // violet-bleu générique que le design system interdit, et le
          // hero est l'un des quatre emplacements où le dégradé maison a
          // le droit d'exister.
          colorStops={["#2ee66b", "#1a9bba", "#0b63f6"]}
          amplitude={1}
          blend={0.5}
          height={0.45}
          speed={1}
          glow={0.6}
          // À pleine opacité, le vert de l'aurore atteint exactement celui
          // de l'accent : le « AI » du logo, qui est en accent, disparaissait
          // dans le fond. Mesuré le 2026-10-28. On baisse plutôt que de
          // retourner le dégradé — le vert passerait à droite et mangerait
          // les pastilles numérotées du programme, qui sont vertes aussi.
          // C'est aussi ce que le commentaire au-dessus réclame depuis le
          // début : un fond qui ne dispute pas la vedette aux chiffres.
          opacity={0.5}
          intro={false}
        />
      </div>

      <div
        className="shell flex flex-1 flex-col
                   pb-[clamp(1rem,4svh,3rem)]
                   pt-[calc(clamp(5.5rem,14svh,11rem)+env(safe-area-inset-top,0rem))]"
      >

        {/* ── Le bloc qui porte tout le hero ───────────────────────── */}
        <div className="flex flex-1 items-center justify-between gap-[clamp(2rem,4vw,5rem)] py-[clamp(0.5rem,3svh,3rem)]">
          <div
            className="flex min-w-0 flex-1 flex-col justify-center
                       gap-[clamp(1rem,4.5svh,3.5rem)]"
          >
            <CountdownFlip dateDebut={edition?.dateDebut ?? null} />

            <h1
            className="max-w-[14ch] text-display font-bold
                       leading-[0.95] tracking-tighter"
          >
            Repars avec ton portfolio{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-signature)" }}
            >
              en ligne
            </span>
            .
          </h1>

          {/* Ce qu'on vend : la nature, la durée, l'endroit. Sous le titre
              et non au-dessus des chiffres — en haut la ligne passait sous
              la capsule de la navbar et ne se lisait pas. */}
          <CarteInfos edition={edition} />

          {/* ── Action, et l'urgence juste à côté ──────────────────── */}
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
            <BoutonReserver />

            {/* Largeur proportionnelle à l'écran, pas un plafond fixe :
                 une barre de 26rem est trop longue sur un 14 pouces. */}
            <div className="w-full max-w-[clamp(12rem,24vw,26rem)]">
              <SeatsGauge
                inscrits={edition?.inscrits ?? null}
                quota={edition?.quota ?? null}
              />
            </div>
            </div>
          </div>

          {/* Les 4 temps de la journée. Visible à partir de xl :
              en dessous, le compte à rebours garde toute la largeur. */}
          <ModulesProgramme />
        </div>

      </div>
    </section>
  );
}
