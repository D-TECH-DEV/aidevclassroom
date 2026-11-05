import { BoutonReserver } from "@/components/inscription/BoutonReserver";
import { EtiquetteSection } from "@/components/ui/EtiquetteSection";
import { Reveal } from "@/components/motion/Reveal";
import { A_DETERMINER, type Edition } from "@/lib/edition";

/**
 * Section — le parcours.
 *
 * Les cartes viennent de la base : sessions ouvertes d'abord, puis
 * celles annoncées en « Bientôt », chacune par date de début
 * décroissante. Aucune session n'est écrite en dur.
 *
 * Seule une session ouverte est verte avec un bouton Réserver : une
 * session « Bientôt » reste en creux, sans bouton — l'API refuse
 * d'ailleurs toute inscription hors `ACTIVE`, un bouton ici mènerait
 * à une erreur garantie.
 */

const A_COMPLETER = "[À COMPLÉTER]";

function CarteSprint({
  numero,
  sprint,
}: {
  numero: string;
  sprint: Edition;
}) {
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(sprint.dateDebut));

  const ligneFait = `${date} · ${sprint.prixFCFA.toLocaleString("fr-FR")} FCFA`;

  // Une session annoncée, pas encore ouverte : le creux de l'ancien
  // design, pas le vert des inscriptions ouvertes. Et pas de bouton :
  // il n'y a encore rien à réserver.
  if (sprint.statut !== "ACTIVE") {
    return (
      <li
        className="flex flex-col rounded-card border border-fg/10
                   p-[clamp(1.5rem,2.5vw,2rem)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-[1ch]">
          <span className="font-mono text-small font-bold text-accent">
            {numero}
          </span>
          <span className="rounded-pill border border-fg/20 px-[1.25ch] py-[0.5ch] text-small text-fg/70">
            Bientôt
          </span>
        </div>

        <h3 className="mt-[clamp(1rem,2.5svh,1.75rem)] text-h2 font-bold tracking-tighter">
          {sprint.nom}
        </h3>

        <p className="mt-[clamp(0.75rem,1.5svh,1rem)] font-mono text-small text-fg/60">
          {ligneFait}
        </p>

        <p className="mt-[clamp(0.75rem,1.5svh,1rem)] font-mono text-small text-accent/70">
          {sprint.description ?? `${A_COMPLETER} — description à saisir côté admin.`}
        </p>
      </li>
    );
  }

  return (
    <li
      className="flex flex-col rounded-card bg-accent
                 p-[clamp(1.5rem,2.5vw,2rem)] text-on-accent"
    >
      <div className="flex flex-wrap items-center justify-between gap-[1ch]">
        <span className="font-mono text-small font-bold">{numero}</span>
        <span className="rounded-pill bg-on-accent/10 px-[1.25ch] py-[0.5ch] text-small font-bold">
          Inscriptions ouvertes
        </span>
      </div>

      <h3 className="mt-[clamp(1rem,2.5svh,1.75rem)] text-h2 font-bold tracking-tighter">
        {sprint.nom}
      </h3>

      <p className="mt-[clamp(0.75rem,1.5svh,1rem)] text-body">
        {sprint.description ?? `${A_COMPLETER} — description à saisir côté admin.`}
      </p>

      <p className="mt-[clamp(0.75rem,1.5svh,1rem)] font-mono text-small font-bold">
        {ligneFait}
      </p>

      {/* Une cale qui pousse le bouton en bas quelle que soit la hauteur
          des cartes voisines, avec un écart minimum garanti : sans elle,
          le bouton flotte au milieu de la plus haute. */}
      <span aria-hidden className="min-h-[clamp(1.5rem,4svh,3rem)] flex-1" />

      <BoutonReserver taille="sm" sprintId={sprint.id}>
        Réserver
      </BoutonReserver>
    </li>
  );
}

export function Parcours({ sprints }: { sprints: Edition[] }) {
  return (
    <section id="parcours" className="relative py-[clamp(4rem,12svh,9rem)]">
      <Reveal className="shell">
        <EtiquetteSection>le parcours</EtiquetteSection>

        <h2 className="mt-[clamp(1rem,3svh,2rem)] max-w-[20ch] text-h1 font-bold leading-[1.05] tracking-tighter">
          Un sprint, un projet concret.
        </h2>

        <p className="mt-[clamp(1rem,2.5svh,1.75rem)] max-w-[60ch] text-body text-fg/70">
          Chaque session = une journée et un vrai projet en ligne à la fin.
        </p>

        {sprints.length > 0 ? (
          <ul className="mt-[clamp(2.5rem,8svh,5rem)] grid gap-[clamp(1rem,1.5vw,1.25rem)] sm:grid-cols-2 xl:grid-cols-4">
            {sprints.map((sprint, i) => (
              <CarteSprint
                key={sprint.id}
                numero={`#${i + 1}`}
                sprint={sprint}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-[clamp(2.5rem,8svh,5rem)] max-w-[60ch] rounded-card border border-fg/10 p-[clamp(1.5rem,2.5vw,2rem)] font-mono text-small text-accent/70">
            {A_DETERMINER} — aucun sprint n&apos;est publié pour l&apos;instant.
            Les inscriptions ouvriront avec la prochaine session.
          </p>
        )}
      </Reveal>
    </section>
  );
}
