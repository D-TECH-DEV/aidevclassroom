import type { NextRequest } from "next/server";
import { relaieExportAdmin } from "@/lib/admin/export-proxy";

export async function GET(requete: NextRequest) {
  const src = requete.nextUrl.searchParams;
  const params = new URLSearchParams();

  const sprintId = src.get("sprintId");
  const status = src.get("status") ?? src.get("statut");
  const search = src.get("search");
  const format = src.get("format");

  if (sprintId) params.set("sprintId", sprintId);
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  if (format) params.set("format", format);

  const ext = format?.toLowerCase() === "pdf" ? "pdf" : "xlsx";
  return relaieExportAdmin(
    "/admin/enrollments/export",
    params,
    `aidevclassroom-inscriptions.${ext}`,
  );
}
