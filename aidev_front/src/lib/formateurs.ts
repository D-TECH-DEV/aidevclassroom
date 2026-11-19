/**
 * Les trois intervenants.
 *
 * Noms, rôles et photos viennent de l'affiche — confirmés.
 * Ce que chacun transmet et ses liens restent à fournir : ils sont marqués
 * `null` et s'affichent comme [À COMPLÉTER], jamais remplacés par un texte
 * crédible inventé.
 */

export type Formateur = {
  prenom: string;
  nom: string | null;
  role: string;
  photo: string;
  /** Badge composé (photo + nom + rôle), généré dans public/badges. */
  badge: string;
  /** Ce qu'il transmet pendant la journée. */
  transmet: string | null;
  liens: { github: string | null; linkedin: string | null };
};

export const FORMATEURS: Formateur[] = [
  {
    prenom: "Victorien",
    nom: null,
    role: "Machine learning",
    photo: "/formateurs/victorien.png",
    badge: "/badges/victorien.png",
    transmet: null,
    liens: { github: null, linkedin: null },
  },
  {
    prenom: "Youssouf",
    nom: "Doumje",
    role: "DevOps & MLOps",
    photo: "/formateurs/youssouf.png",
    badge: "/badges/youssouf.png",
    transmet: "Déploiement, mise en production, infrastructure.",
    liens: { github: null, linkedin: null },
  },
  {
    prenom: "Abdel Malik",
    nom: null,
    role: "Frontend & design",
    photo: "/formateurs/malik.png",
    badge: "/badges/malik.png",
    transmet:
      "Comment fonctionnent les skills, et comment obtenir un design qui n'est pas cliché avec l'IA.",
    liens: { github: null, linkedin: null },
  },
];
