import { NextResponse } from "next/server";
import { BASE_API } from "@/lib/api";
import { litSession } from "@/lib/admin/session";

/**
 * Relaie un téléchargement Excel depuis le backend NestJS en utilisant
 * le JWT stocké dans le cookie `httpOnly` `aidevsprint_admin`.
 */
export async function relaieExportAdmin(
  cheminApi: string,
  params: URLSearchParams,
  nomFichierDefaut: string,
) {
  const token = await litSession();
  if (!token) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }
  if (!BASE_API) {
    return NextResponse.json(
      { message: "NEXT_PUBLIC_API_URL non configurée." },
      { status: 500 },
    );
  }

  const query = params.toString();
  const url = `${BASE_API}${cheminApi}${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { message: "Impossible de générer l'export." },
      { status: res.status },
    );
  }

  const buffer = await res.arrayBuffer();
  const contentType =
    res.headers.get("content-type") ??
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const disposition =
    res.headers.get("content-disposition") ??
    `attachment; filename="${nomFichierDefaut}"`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "no-store",
    },
  });
}
