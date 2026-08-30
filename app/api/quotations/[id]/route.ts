import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { loadQuotationFor } from "@/lib/quotations";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await resolveActor(await auth());
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await loadQuotationFor(id, actor);
  // loadQuotationFor deliberately returns the same "not found" for missing and
  // forbidden, so this endpoint can't be used to probe whether another rep's
  // quotation id exists.
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json(result.data);
}
