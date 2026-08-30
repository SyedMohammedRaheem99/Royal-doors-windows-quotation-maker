import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { listCustomersFor } from "@/lib/customers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await resolveActor(await auth());
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = Number(url.searchParams.get("page")) || 1;

  const result = await listCustomersFor(actor, { search: q || undefined, page });
  return NextResponse.json(result);
}
