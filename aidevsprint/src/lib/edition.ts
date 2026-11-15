import { api, ErreurApi, type Page } from "@/lib/api";

/**
 * L'édition courante, telle que le site l'affiche.
 *
 * Elle vient maintenant de l'API (`GET /sprints`, voir `docs/api.md`) et
 * non plus d'un fichier de démonstration — branchée le 2026-10-28.
 *
 * ── Ce que l'API ne porte pas ────────────────────────────────────────
 * Un `Sprint` n'a ni ville, ni lieu, ni format : le modèle a été écrit
 * pour des sprints de plusieurs semaines, pas pour une journée dans une
 * salle précise. Ces trois faits sont donc tenus ici, dans `FAITS_LOCAUX`.
 * Ils viennent du brief et de Malik, ils sont confirmés — ce n'est pas du
 * remplissage. Le jour où l'API gagne les champs, `FAITS_LOCAUX` meurt.
 *
 * Le nombre d'inscrits, lui, vient de l'API : chaque sprint du catalogue
 * public porte `enrolledSeats` (personnes ayant versé le minimum) et
 * `enrolledCount` (dossiers qualifiés). Sans ces champs — API d'avant le
 * compteur, ou réponse en cache — `inscrits` reste `null` et la jauge
 * affiche [À DÉTERMINER].
 */

/**
 * Le sprint tel que le catalogue public le renvoie (`docs/api.md`
 * § Sprints) : les sessions ouvertes et celles annoncées en
 * « Bientôt ». Ni brouillons, ni sessions terminées.
 */
export type Sprint = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  priceXof: number;
  minimumPaymentXof: number;
  duoPriceXof: number | null;
  duoMinimumPaymentXof: number | null;
  startAt: string;
  endAt: string;
  capacity: number | null;
  status: "ACTIVE" | "INACTIVE";
  /** Dossiers ayant versé le minimum (toujours présent, `0` si aucun). */
  enrolledCount: number;
  /** Personnes inscrites — un dossier DUO qualifié vaut 2. */
  enrolledSeats: number;
};

export type Edition = {
  /** La clé du sprint. C'est elle que le formulaire envoie en `sprintId`. */
  id: number;
  /** `ACTIVE` = inscriptions ouvertes, `INACTIVE` = annoncée en « Bientôt ». */
  statut: "ACTIVE" | "INACTIVE";
  /** Le nom donné au sprint côté admin — il s'affiche tel quel. */
  nom: string;
  /** Le texte saisi côté admin, ou `null` s'il n'y en a pas. */
  description: string | null;
  /** ISO 8601. */
  dateDebut: string;
  ville: string;
  lieu: string;
  prixFCFA: number;
  /** `null` = places illimitées, c'est la convention de l'API. */
  quota: number | null;
  /** Personnes ayant versé le minimum, `null` si le compteur est absent. */
  inscrits: number | null;
  format: string;
  /** Le versement minimum accepté. Égal au prix s'il faut tout payer. */
  minimumFCFA: number;
  /** Prix duo pour 2 places, ou `null` quand le forfait duo est indisponible. */
  prixDuoFCFA: number | null;
  /** Minimum duo, ou `null` (on utilise alors `minimumFCFA`). */
  minimumDuoFCFA: number | null;
};

/**
 * Les faits que l'API ne sait pas porter. Tous confirmés :
 * la ville et le format viennent de l'affiche, le lieu a été donné par
 * Malik le 2026-10-19.
 */
export const FAITS_LOCAUX = {
  ville: "Yamoussoukro",
  lieu: "Mairie de Yamoussoukro — salle multimédia Orange",
  format: "1 journée · présentiel",
} as const;

/** Libellé affiché pour un champ non encore arrêté. */
export const A_DETERMINER = "[À DÉTERMINER]";

export function versEdition(sprint: Sprint): Edition {
  return {
    id: sprint.id,
    statut: sprint.status,
    nom: sprint.name,
    description: sprint.description,
    dateDebut: sprint.startAt,
    prixFCFA: sprint.priceXof,
    minimumFCFA: sprint.minimumPaymentXof,
    prixDuoFCFA: sprint.duoPriceXof ?? null,
    minimumDuoFCFA: sprint.duoMinimumPaymentXof ?? null,
    quota: sprint.capacity,
    // Compteur public : les places occupées (un DUO qualifié = 2),
    // repli sur les dossiers, `null` si l'API ne porte pas le compteur.
    inscrits: sprint.enrolledSeats ?? sprint.enrolledCount ?? null,
    ...FAITS_LOCAUX,
  };
}

/**
 * L'édition à afficher, ou `null` s'il n'y en a pas.
 *
 * `null` n'est pas une erreur : tant qu'aucun sprint n'est `ACTIVE` côté
 * admin, le catalogue public est vide et c'est le cas aujourd'hui. Le site
 * doit savoir se montrer sans édition — date, prix et places en
 * [À DÉTERMINER], inscriptions fermées. Il ne doit surtout pas afficher
 * les valeurs de la dernière fois.
 *
 * Une API injoignable donne le même `null` : la page se construit quand
 * même. Un site qui ne compile plus parce qu'un serveur tousse, c'est pire
 * qu'un site incomplet.
 */
/**
 * Tous les sprints visibles du site : les sessions ouvertes d'abord,
 * puis celles annoncées en « Bientôt », chacune par date de début
 * décroissante.
 *
 * C'est cette liste qui fait vivre la section Parcours : aucun sprint
 * n'est écrit en dur dans le site. Vide quand rien n'est publié côté
 * admin, ou quand l'API est injoignable.
 */
export async function recupereSprints(): Promise<Edition[]> {
  try {
    // `GET /sprints` renvoie `ACTIVE` et `INACTIVE`, triés du plus récent
    // au plus ancien. Le filtre ci-dessous ne garde que ces deux statuts
    // par prudence, et c'est ici que l'ordre d'affichage se décide.
    const page = await api<Page<Sprint>>("/sprints?page=1&limit=20", {
      revalider: 900,
    });
    const rang = (statut: Edition["statut"]) =>
      statut === "ACTIVE" ? 0 : 1;
    return page.items
      .filter(
        (sprint) =>
          sprint.status === "ACTIVE" || sprint.status === "INACTIVE",
      )
      .map(versEdition)
      .sort(
        (a, b) =>
          rang(a.statut) - rang(b.statut) ||
          +new Date(b.dateDebut) - +new Date(a.dateDebut),
      );
  } catch (cause) {
    console.error(
      "[edition] catalogue illisible :",
      cause instanceof ErreurApi
        ? `${cause.statusCode} ${cause.code} — ${cause.message}`
        : cause,
    );
    return [];
  }
}

/** La session ouverte mise en avant (hero, section, modale). */
export async function recupereEdition(): Promise<Edition | null> {
  const sprints = await recupereSprints();
  return sprints.find((sprint) => sprint.statut === "ACTIVE") ?? null;
}
