import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const { rows } = await db.query(
      `SELECT * FROM area_gap ORDER BY gap_score DESC, slug`
    );
    return NextResponse.json({ islands: rows });
  } catch {
    return NextResponse.json(
      { error: "DBに接続できません。docker compose up -d を実行してください" },
      { status: 500 }
    );
  }
}
