import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// Renvoie l'identité de l'utilisateur connecté, y compris is_founder LU EN
// BASE (pas depuis le JWT) — c'est ce que le dashboard utilise pour décider
// d'afficher ou non le lien vers l'espace Fondateur.
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { rows } = await query(
    `SELECT id, full_name, email, phone, is_founder FROM users WHERE id = $1`,
    [session.userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  return NextResponse.json({ user: rows[0] });
}
