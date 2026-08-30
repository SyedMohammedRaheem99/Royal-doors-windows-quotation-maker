import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/authz";
import { createQuotation, listQuotationsFor } from "@/lib/quotations";
import { QuotationInputSchema } from "@/models/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await resolveActor(await auth());
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = Number(new URL(request.url).searchParams.get("page")) || 1;
  const result = await listQuotationsFor(actor, { page });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const actor = await resolveActor(await auth());
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = QuotationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quotation payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createQuotation(parsed.data, actor.id);
  return NextResponse.json(result, { status: 201 });
}
