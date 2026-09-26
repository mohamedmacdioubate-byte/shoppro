import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { isFounder } from "@/lib/founder";

const StatusSchema = z.object({
  status: z.enum([
    "en_attente", "en_negociation", "offre_proposee", "paiement_en_attente",
    "en_essai", "active", "suspendue", "resiliee",
  ]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await isFounder(session.userId))) {
    return NextResponse.json({ error: "Accès réservé au Fondateur" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { rows } = await query(
    `UPDATE companies SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [parsed.data.status, params.id]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  }

  await query(
    `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, 'company.status_changed', 'company', $2, $3)`,
    [session.userId, params.id, JSON.stringify({ status: parsed.data.status })]
  );

  return NextResponse.json({ company: rows[0] });
}
