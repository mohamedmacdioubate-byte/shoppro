import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// Résolution PUBLIQUE d'un QR code : ne renvoie qu'une redirection vers une
// page publique (catalogue, promotion...). Ne renvoie et n'attribue JAMAIS
// de rôle ou de droit — scanner un code ne peut en aucun cas donner un accès
// administrateur ou Fondateur.
export async function GET(req: Request, { params }: { params: { code: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { rows } = await query(
    `SELECT id, company_id, target_type, active FROM qr_codes WHERE code = $1`,
    [params.code]
  );
  if (rows.length === 0 || !rows[0].active) {
    return NextResponse.json({ error: "Code introuvable ou désactivé" }, { status: 404 });
  }

  await query(`UPDATE qr_codes SET scan_count = scan_count + 1 WHERE id = $1`, [rows[0].id]);

  return NextResponse.json({ companyId: rows[0].company_id, targetType: rows[0].target_type });
}
