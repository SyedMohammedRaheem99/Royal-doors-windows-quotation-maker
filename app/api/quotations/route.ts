import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { actorFromSession } from "@/lib/authz";
import { createQuotation, listQuotationsFor } from "@/lib/quotations";
import { QuotationInputSchema } from "@/models/schemas";

export const runtime = "nodejs";

export async function GET() {
  const actor = actorFromSession(await auth());
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotations = await listQuotationsFor(actor, { limit: 100 });
  return NextResponse.json(quotations);
}

export async function POST(request: Request) {
  const actor = actorFromSession(await auth());
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = QuotationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quotation payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createQuotation(parsed.data, actor.id);
  return NextResponse.json(result, { status: 201 });
}
