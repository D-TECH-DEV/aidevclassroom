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

  const res = await fetch(`${BASE_API}/uploads/formateurs/${filename}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ message: "Introuvable." }, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
