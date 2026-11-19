import { NextResponse, type NextRequest } from "next/server";
import { BASE_API } from "@/lib/api";

const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.png$/;

export async function GET(
  _requete: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!SAFE_FILENAME.test(filename) || !BASE_API) {
    return NextResponse.json({ message: "Introuvable." }, { status: 404 });
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_API}/uploads/formateurs/${filename}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json(
      { message: "Service média indisponible." },
      { status: 502 },
    );
  }
  if (!res.ok) {
    return NextResponse.json({ message: "Introuvable." }, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
