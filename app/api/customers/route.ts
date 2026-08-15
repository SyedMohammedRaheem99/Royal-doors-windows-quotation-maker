import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { actorFromSession } from "@/lib/authz";
import { listCustomersFor } from "@/lib/customers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = actorFromSession(await auth());
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const customers = await listCustomersFor(actor, { search: q || undefined, limit: 50 });
  return NextResponse.json(customers);
}
