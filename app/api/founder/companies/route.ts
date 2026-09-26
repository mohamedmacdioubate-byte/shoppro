import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { isFounder } from "@/lib/founder";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await isFounder(session.userId))) {
    return NextResponse.json({ error: "Accès réservé au Fondateur" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const { rows } = await query(
    `SELECT id, name, sector, city, phone, email, status, created_at
     FROM companies
     WHERE ($1::company_status IS NULL OR status = $1)
     ORDER BY created_at DESC`,
    [status]
  );

  return NextResponse.json({ companies: rows });
}
