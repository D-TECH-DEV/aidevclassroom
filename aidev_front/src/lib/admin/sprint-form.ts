import type { NouveauSprint, SprintModifie } from "@/lib/admin/api";

const SLUG_OK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function versIso(valeur: string): string | null {
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function litPrixDuo(donnees: FormData):
  | { duoPriceXof: number | null; duoMinimumPaymentXof: number | null }
  | { erreur: string } {
  const brutPrixDuo = String(donnees.get("prixDuo") ?? "").trim();
  const brutMinimumDuo = String(donnees.get("minimumDuo") ?? "").trim();
  if (!brutPrixDuo && !brutMinimumDuo) {
    return { duoPriceXof: null, duoMinimumPaymentXof: null };
  }
  if (!brutPrixDuo) {
    return { erreur: "Le prix duo est requis quand un minimum duo est saisi." };
  }
  const duoPriceXof = Number(brutPrixDuo);
  if (!Number.isInteger(duoPriceXof) || duoPriceXof <= 0) {
    return { erreur: "Le prix duo doit être un entier positif en FCFA." };
  }
  let duoMinimumPaymentXof: number | null = null;
  if (brutMinimumDuo) {
    duoMinimumPaymentXof = Number(brutMinimumDuo);
    if (!Number.isInteger(duoMinimumPaymentXof) || duoMinimumPaymentXof < 1) {
      return { erreur: "Le minimum duo doit être au moins 1 FCFA." };
    }
    if (duoMinimumPaymentXof > duoPriceXof) {
      return { erreur: "Le minimum duo ne peut pas dépasser le prix duo." };
    }
  }
  return { duoPriceXof, duoMinimumPaymentXof };
}

type OrganisationSprint = {
  city: string | null;
  location: string | null;
  format: string | null;
  level: string | null;
  modules: string[];
};

function litOrganisationSprint(
  donnees: FormData,
): OrganisationSprint | { erreur: string } {
  const city = String(donnees.get("ville") ?? "").trim() || null;
  const location = String(donnees.get("lieu") ?? "").trim() || null;
  const format = String(donnees.get("format") ?? "").trim() || null;
  const level = String(donnees.get("niveau") ?? "").trim() || null;
  const brutModules = String(donnees.get("modules") ?? "");
  const modules = brutModules
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0);

  if (city && city.length > 100) {
    return { erreur: "La ville ne doit pas dépasser 100 caractères." };
  }
  if (location && location.length > 255) {
    return { erreur: "Le lieu ne doit pas dépasser 255 caractères." };
  }
  if (format && format.length > 120) {
    return { erreur: "Le format ne doit pas dépasser 120 caractères." };
  }
  if (level && level.length > 120) {
    return { erreur: "Le niveau ne doit pas dépasser 120 caractères." };
  }
  if (modules.length > 8) {
    return { erreur: "Maximum 8 étapes dans le programme." };
  }
  if (modules.some((m) => m.length > 160)) {
    return {
      erreur: "Chaque étape du programme ne doit pas dépasser 160 caractères.",
    };
  }
  return { city, location, format, level, modules };
}

export function parseCreationSprint(
  donnees: FormData,
): { payload: NouveauSprint } | { erreur: string } {
  const name = String(donnees.get("nom") ?? "").trim();
  const slug = String(donnees.get("slug") ?? "").trim().toLowerCase();
  const description = String(donnees.get("description") ?? "").trim();
  const priceXof = Number(donnees.get("prix"));
  const minimumPaymentXof = Number(donnees.get("minimum"));
  const brutDebut = String(donnees.get("debut") ?? "");
  const brutFin = String(donnees.get("fin") ?? "");
  const brutCapacite = String(donnees.get("capacite") ?? "").trim();
  const lancer = donnees.get("lancer") === "oui";

  if (!name) return { erreur: "Le nom du sprint est requis." };
  if (!SLUG_OK.test(slug)) {
    return {
      erreur:
        "Slug invalide : lettres minuscules, chiffres et tirets uniquement.",
    };
  }
  if (!Number.isInteger(priceXof) || priceXof <= 0) {
    return { erreur: "Le prix doit être un entier positif en FCFA." };
  }
  if (!Number.isInteger(minimumPaymentXof) || minimumPaymentXof < 1) {
    return { erreur: "Le versement minimum doit être au moins 1 FCFA." };
  }
  if (minimumPaymentXof > priceXof) {
    return { erreur: "Le versement minimum ne peut pas dépasser le prix." };
  }

  const duo = litPrixDuo(donnees);
  if ("erreur" in duo) return { erreur: duo.erreur };

  const startAt = versIso(brutDebut);
  const endAt = versIso(brutFin);
  if (!startAt || !endAt) {
    return { erreur: "Les dates de début et de fin sont requises." };
  }
  if (new Date(startAt) >= new Date(endAt)) {
    return { erreur: "La date de fin doit être après la date de début." };
  }

  let capacity: number | null | undefined;
  if (brutCapacite) {
    const n = Number(brutCapacite);
    if (!Number.isInteger(n) || n < 1) {
      return { erreur: "La capacité doit être un entier positif." };
    }
    capacity = n;
  }

  const org = litOrganisationSprint(donnees);
  if ("erreur" in org) return { erreur: org.erreur };

  return {
    payload: {
      name,
      slug,
      description: description || undefined,
      priceXof,
      minimumPaymentXof,
      duoPriceXof: duo.duoPriceXof,
      duoMinimumPaymentXof: duo.duoMinimumPaymentXof,
      startAt,
      endAt,
      capacity,
      city: org.city ?? undefined,
      location: org.location ?? undefined,
      format: org.format ?? undefined,
      level: org.level ?? undefined,
      modules: org.modules.length > 0 ? org.modules : undefined,
      status: lancer ? "ACTIVE" : "DRAFT",
    },
  };
}

export function parseModificationSprint(
  donnees: FormData,
): { id: number; patch: SprintModifie } | { erreur: string } {
  const id = Number(donnees.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { erreur: "Sprint introuvable." };
  }
  const name = String(donnees.get("nom") ?? "").trim();
  const description = String(donnees.get("description") ?? "").trim();
  if (!name) return { erreur: "Le nom du sprint est requis." };

  const patch: SprintModifie = { name, description };
  const prix = String(donnees.get("prix") ?? "").trim();
  if (prix) {
    const priceXof = Number(prix);
    if (!Number.isInteger(priceXof) || priceXof <= 0) {
      return { erreur: "Le prix doit être un entier positif en FCFA." };
    }
    patch.priceXof = priceXof;
  }
  const minimum = String(donnees.get("minimum") ?? "").trim();
  if (minimum) {
    const minimumPaymentXof = Number(minimum);
    if (!Number.isInteger(minimumPaymentXof) || minimumPaymentXof < 1) {
      return { erreur: "Le versement minimum doit être au moins 1 FCFA." };
    }
    patch.minimumPaymentXof = minimumPaymentXof;
  }
  const duo = litPrixDuo(donnees);
  if ("erreur" in duo) return { erreur: duo.erreur };

  const veutDuo =
    String(donnees.get("prixDuo") ?? "").trim().length > 0 ||
    String(donnees.get("minimumDuo") ?? "").trim().length > 0;
  if (veutDuo) {
    patch.duoPriceXof = duo.duoPriceXof;
    patch.duoMinimumPaymentXof = duo.duoMinimumPaymentXof;
  } else if (donnees.get("retirerDuo") === "oui") {
    patch.duoPriceXof = null;
    patch.duoMinimumPaymentXof = null;
  }

  const debut = String(donnees.get("debut") ?? "").trim();
  if (debut) {
    const startAt = versIso(debut);
    if (!startAt) return { erreur: "Date de début invalide." };
    patch.startAt = startAt;
  }
  const fin = String(donnees.get("fin") ?? "").trim();
  if (fin) {
    const endAt = versIso(fin);
    if (!endAt) return { erreur: "Date de fin invalide." };
    patch.endAt = endAt;
  }
  const brutCapacite = String(donnees.get("capacite") ?? "").trim();
  if (brutCapacite) {
    const n = Number(brutCapacite);
    if (!Number.isInteger(n) || n < 1) {
      return { erreur: "La capacité doit être un entier positif." };
    }
    patch.capacity = n;
  }

  const org = litOrganisationSprint(donnees);
  if ("erreur" in org) return { erreur: org.erreur };
  patch.city = org.city;
  patch.location = org.location;
  patch.format = org.format;
  patch.level = org.level;
  patch.modules = org.modules;

  return { id, patch };
}
