/**
 * Le client de l'API Aidev Classroom.
 *
 * Base : `https://aidev.you-soft.com/api/v1` — NestJS, documentée dans
 * `docs/api.md`. Branchée le 2026-10-28 ; elle remplace le Laravel qui
 * vivait dans `backend/`.
 *
 * Deux formes de réponse, toujours les mêmes :
 *   succès → `{ "data": …, "meta": {} }`
 *   erreur → `{ "statusCode": 404, "code": "SPRINT_NOT_FOUND", "message": … }`
 *
 * Ce module déballe la première et transforme la seconde en `ErreurApi`.
 * Personne d'autre dans le site ne touche à `fetch` : le jour où la base
 * change, elle change ici.
 *
 * ── Navigateur contre serveur ──────────────────────────────────────
 * Côté serveur (panneau admin, lecture du catalogue), on appelle l'API
 * en direct : pas de CORS entre serveurs. Côté navigateur (inscription,
 * paiement), on passe par le relais même-origine `/api` (voir
 * `src/app/api/[...chemin]/route.ts`) : l'API n'autorise que les
 * origines de son `FRONTEND_URL`, et un appel direct depuis une autre
 * origine meurt au précontrôle CORS avant même de partir.
 */

/**
 * Pas de valeur par défaut. Un repli silencieux sur une adresse en dur
 * partirait en production et les inscriptions se perdraient sans bruit :
 * sans la variable, les appels échouent franchement et le site le dit.
 */
export const BASE_API = process.env.NEXT_PUBLIC_API_URL;

/** Le `code` métier du back, quand il y en a un. */
export class ErreurApi extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "ErreurApi";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** L'API n'est pas configurée, ou injoignable. Ce n'est pas un refus. */
export class ErreurReseau extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurReseau";
  }
}

type Options = RequestInit & {
  /** Secondes de cache côté serveur. Ignoré dans le navigateur. */
  revalider?: number;
  /** Jeton de suivi d'une inscription, pour les routes participant. */
  jetonSuivi?: string;
};

export async function api<T>(
  chemin: string,
  { revalider, jetonSuivi, headers, ...init }: Options = {},
): Promise<T> {
  // Le navigateur ne parle qu'au relais même-origine (voir l'en-tête du
  // module) : l'URL directe n'est utilisée que côté serveur.
  const base =
    typeof window === "undefined"
      ? (BASE_API ??
        (() => {
          throw new ErreurReseau("NEXT_PUBLIC_API_URL n'est pas configurée.");
        })())
      : "/api";

  let reponse: Response;
  try {
    reponse = await fetch(`${base}${chemin}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(jetonSuivi ? { "x-tracking-token": jetonSuivi } : {}),
        ...headers,
      },
      ...(revalider === undefined ? {} : { next: { revalidate: revalider } }),
    });
  } catch (cause) {
    // DNS, TLS, CORS, hors-ligne : le navigateur ne distingue pas, et nous
    // non plus. Tout ce qu'on sait, c'est qu'on n'a pas eu de réponse.
    throw new ErreurReseau(String(cause));
  }

  const corps: unknown = await reponse.json().catch(() => null);

  if (!reponse.ok) {
    const erreur = (corps ?? {}) as {
      code?: string;
      message?: string | string[];
    };
    throw new ErreurApi(
      reponse.status,
      erreur.code ?? "ERREUR",
      // La validation NestJS renvoie parfois un tableau de messages.
      Array.isArray(erreur.message)
        ? erreur.message.join(" ")
        : (erreur.message ?? `HTTP ${reponse.status}`),
    );
  }

  return (corps as { data: T }).data;
}

/** L'enveloppe des listes paginées. Pas de `totalPages`, c'est voulu. */
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
