import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const settings = await db.collection("settings").findOne({});
  if (!settings) return NextResponse.json({ error: "Settings not seeded" }, { status: 404 });
  return NextResponse.json(settings);
}
