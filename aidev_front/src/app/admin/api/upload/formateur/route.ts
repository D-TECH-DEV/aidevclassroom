import { NextResponse, type NextRequest } from "next/server";
import { BASE_API } from "@/lib/api";
import { litSession } from "@/lib/admin/session";

export async function POST(requete: NextRequest) {
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

  const formData = await requete.formData();
  let res: Response;
  try {
    res = await fetch(`${BASE_API}/admin/site-content/trainer-photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json(
      { message: "L'API est injoignable." },
      { status: 502 },
    );
  }

  const brut = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const payload =
    brut && typeof brut.data === "object" && brut.data !== null
      ? brut.data
      : brut;
  return NextResponse.json(payload, { status: res.status });
}
