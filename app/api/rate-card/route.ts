import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const entries = await db.collection("rateCard").find({ active: true }).sort({ category: 1, label: 1 }).toArray();
  return NextResponse.json(entries);
}
