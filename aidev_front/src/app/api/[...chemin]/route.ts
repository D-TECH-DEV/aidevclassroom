import { BASE_API } from "@/lib/api";

/**
 * Le relais des appels publics vers l'API, en même origine.
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────
 * Le navigateur n'a le droit d'appeler l'API que depuis les origines
 * listées dans `FRONTEND_URL` côté serveur — aujourd'hui
 * `http://localhost:5173` uniquement. Depuis n'importe quelle autre
 * origine (le `npm run dev` en :3000, le site déployé), le précontrôle
 * CORS échoue et le `fetch` lève avant même de partir : l'inscription
 * affiche « Impossible de joindre le serveur » alors que tout est en
 * ligne. La liste des sprints, elle, marche — elle part du serveur
 * Next, qui ignore CORS.
 *
 * Ce relais contourne le problème sans toucher au serveur : le
 * navigateur appelle `/api/…` (même origine, jamais de précontrôle
 * bloquant) et c'est le serveur Next qui appelle la vraie API.
 *
 * ── Garde-fous ───────────────────────────────────────────────────────
 * Seules les racines publiques passent : sprints, enrollments,
 * payments, students, health. Ni `/admin/…` ni `/auth/…` — le JWT
 * d'administration ne transite jamais par ici, et seuls
 * `content-type` et `x-tracking-token` sont retransmis (jamais
 * `cookie` ni `authorization`).
 *
 * Le statut et le corps de l'API sont renvoyés tels quels : le client
 * voit les mêmes `ErreurApi` que s'il appelait en direct.
 */

const PUBLIQUES = new Set([
  "sprints",
  "site-content",
  "enrollments",
  "payments",
  "health",
]);

const MAX_BODY_BYTES = 256 * 1024;
const RELAY_TIMEOUT_MS = 15_000;

function refuse() {
  return Response.json(
    { statusCode: 404, code: "NOT_FOUND", message: "Introuvable." },
    { status: 404 },
  );
}

async function relaie(requete: Request, chemin: string[]) {
  if (!BASE_API) {
    return Response.json(
      {
        statusCode: 500,
        code: "ERREUR",
        message: "NEXT_PUBLIC_API_URL n'est pas configurée.",
      },
      { status: 500 },
    );
  }

  const racine = chemin[0];
  if (!racine || !PUBLIQUES.has(racine)) return refuse();
  if (racine === "payments" && chemin[1] === "webhook") return refuse();

  const contentLength = Number(requete.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Response.json(
      {
        statusCode: 413,
        code: "PAYLOAD_TOO_LARGE",
        message: "Requête trop volumineuse.",
      },
      { status: 413 },
    );
  }

  let bodyBuffer: ArrayBuffer | undefined;
  if (requete.method !== "GET" && requete.method !== "HEAD") {
    bodyBuffer = await requete.arrayBuffer();
    if (bodyBuffer.byteLength > MAX_BODY_BYTES) {
      return Response.json(
        {
          statusCode: 413,
          code: "PAYLOAD_TOO_LARGE",
          message: "Requête trop volumineuse.",
        },
        { status: 413 },
      );
    }
  }

  const adresse = new URL(requete.url);
  const cible = `${BASE_API}/${chemin.map(encodeURIComponent).join("/")}${adresse.search}`;

  const entetes = new Headers();
  entetes.set("Accept", "application/json");
  const typeContenu = requete.headers.get("content-type");
  if (typeContenu) entetes.set("Content-Type", typeContenu);
  const jetonSuivi = requete.headers.get("x-tracking-token");
  if (jetonSuivi) entetes.set("x-tracking-token", jetonSuivi);
  const receiptSig = requete.headers.get("x-receipt-sig");
  if (receiptSig) entetes.set("x-receipt-sig", receiptSig);
  const receiptExp = requete.headers.get("x-receipt-exp");
  if (receiptExp) entetes.set("x-receipt-exp", receiptExp);
  const clientIp =
    requete.headers.get("x-forwarded-for") ?? requete.headers.get("x-real-ip");
  if (clientIp) entetes.set("x-forwarded-for", clientIp);

  let reponse: Response;
  try {
    reponse = await fetch(cible, {
      method: requete.method,
      headers: entetes,
      body: bodyBuffer,
      cache: "no-store",
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    return Response.json(
      {
        statusCode: isTimeout ? 504 : 502,
        code: "ERREUR",
        message: isTimeout
          ? "L'API met trop de temps à répondre."
          : "L'API est injoignable.",
      },
      { status: isTimeout ? 504 : 502 },
    );
  }

  const corps = await reponse.arrayBuffer();
  const resHeaders = new Headers();
  resHeaders.set(
    "content-type",
    reponse.headers.get("content-type") ?? "application/json",
  );
  const disposition = reponse.headers.get("content-disposition");
  if (disposition) resHeaders.set("content-disposition", disposition);
  return new Response(corps, {
    status: reponse.status,
    headers: resHeaders,
  });
}

type Params = { params: Promise<{ chemin: string[] }> };

export function GET(requete: Request, { params }: Params) {
  return params.then((p) => relaie(requete, p.chemin));
}

export function POST(requete: Request, { params }: Params) {
  return params.then((p) => relaie(requete, p.chemin));
}
