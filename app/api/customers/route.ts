import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const db = await getDb();

  const filter = q
    ? { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
    : {};

  const customers = await db.collection("customers").find(filter).sort({ name: 1 }).limit(50).toArray();
  return NextResponse.json(customers);
}
