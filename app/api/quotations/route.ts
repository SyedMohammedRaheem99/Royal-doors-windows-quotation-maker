import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { createQuotation } from "@/lib/quotations";
import { QuotationInputSchema } from "@/models/schemas";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const filter = session.user.role === "admin" ? {} : { createdBy: session.user.id };
  const quotations = await db
    .collection("quotations")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return NextResponse.json(quotations);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = QuotationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quotation payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createQuotation(parsed.data, session.user.id);
  return NextResponse.json(result, { status: 201 });
}
