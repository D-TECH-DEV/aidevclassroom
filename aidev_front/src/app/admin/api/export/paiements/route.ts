import type { NextRequest } from "next/server";
import { relaieExportAdmin } from "@/lib/admin/export-proxy";

export async function GET(requete: NextRequest) {
  const src = requete.nextUrl.searchParams;
  const params = new URLSearchParams();

  const enrollmentId = src.get("enrollmentId");
  const sprintId = src.get("sprintId");
  const status = src.get("status") ?? src.get("statut");
  const reference = src.get("reference");
  const format = src.get("format");

  if (enrollmentId) params.set("enrollmentId", enrollmentId);
  if (sprintId) params.set("sprintId", sprintId);
  if (status) params.set("status", status);
  if (reference) params.set("reference", reference);
  if (format) params.set("format", format);

  const ext = format?.toLowerCase() === "pdf" ? "pdf" : "xlsx";
  return relaieExportAdmin(
    "/admin/payments/export",
    params,
    `aidevclassroom-paiements.${ext}`,
  );
}
