# Exemples TypeScript / JavaScript

Base : `https://aidev.you-soft.com/api/v1`. Données fictives. Secrets via variables d'environnement.

## Client `fetch` centralisé

```ts
const BASE = process.env.API_URL ?? "https://aidev.you-soft.com/api/v1";
let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

export async function api<T>(path: string, init: RequestInit = {}, trackingToken?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (trackingToken) headers["x-tracking-token"] = trackingToken;
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers as object ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.message ?? `HTTP ${res.status}`), { status: res.status, code: body.code, body });
  return body.data as T;
}
```

Gestion d'erreurs :

```ts
try {
  await api("/auth/me");
} catch (e: any) {
  if (e.status === 401) location.href = "/login";
  else if (e.status === 409) alert(`Conflit (${e.code}) : ${e.message}`);
  else alert(e.message);
}
```

## Client Axios

```ts
import axios from "axios";
export const http = axios.create({ baseURL: "https://aidev.you-soft.com/api/v1" });
http.interceptors.request.use((c) => {
  const t = localStorage.getItem("accessToken");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
http.interceptors.response.use((r) => r.data.data, (err) => {
  const b = err.response?.data ?? {};
  return Promise.reject({ status: err.response?.status, code: b.code, message: b.message });
});
```

## Connexion

```ts
const { accessToken } = await api<{ accessToken: string }>("/auth/login", {
  method: "POST", body: JSON.stringify({ email: "admin@exemple.com", password: "MotDePasse123" })
});
setToken(accessToken);
```

## Créer un étudiant (public)

```ts
const { student, created } = await api("/students", {
  method: "POST",
  body: JSON.stringify({ firstName: "Awa", lastName: "Diallo", email: "awa@exemple.com", phone: "+2250700000000" })
});
```

## Catalogue des sprints (public)

```ts
const page = await api<{ items: any[]; total: number }>("/sprints?page=1&limit=20");
```

## Inscription (publique) — conserver le trackingToken

```ts
const { enrollment, trackingToken } = await api("/enrollments", {
  method: "POST",
  body: JSON.stringify({ sprintId: 3, student: { firstName: "Awa", lastName: "Diallo", email: "awa@exemple.com", phone: "+2250700000000" } })
});
sessionStorage.setItem(`tracking:${enrollment.id}`, trackingToken);
const statut = await api(`/enrollments/${enrollment.id}/status`, {}, trackingToken);
```

## Paiement : initialize → Paystack → verify

```ts
const init = await api<{ authorizationUrl: string; reference: string }>(
  `/payments/enrollments/${enrollmentId}/initialize`,
  { method: "POST", body: JSON.stringify({ amountXof: 10000 }) },
  trackingToken
);
location.href = init.authorizationUrl; // redirection Paystack
// ... au retour (callback frontend ?reference=...) :
const payment = await api(`/payments/${reference}/verify`, {}, trackingToken);
console.log(payment.status); // PENDING | SUCCESS | FAILED
```

## Appels admin

```ts
const sprints = await api("/admin/sprints?status=ACTIVE");
const change = await api(`/admin/enrollments/${id}/status`, {
  method: "PATCH", body: JSON.stringify({ status: "CONFIRMED" })
});
const summary = await api("/admin/dashboard/summary");
```
