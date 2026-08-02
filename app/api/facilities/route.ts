import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const island = req.nextUrl.searchParams.get("island");
  try {
    const db = await getDb();
    const { rows } = await db.query(
      `SELECT f.*, a.name AS area_name, a.municipality
       FROM facilities f
       JOIN areas a ON a.slug = f.area_slug
       ${island ? "WHERE f.area_slug = $1" : ""}
       ORDER BY f.is_emergency DESC, f.name`,
      island ? [island] : []
    );
    return NextResponse.json({ facilities: rows });
  } catch {
    return NextResponse.json(
      { error: "DBに接続できません。docker compose up -d を実行してください" },
      { status: 500 }
    );
  }
}
