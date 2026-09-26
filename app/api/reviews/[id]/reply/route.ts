import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership, hasPermission } from "@/lib/tenant";

// Répondre à un avis — jamais de suppression exposée ici : une entreprise
// ne peut pas supprimer librement un avis négatif (règle métier du cahier
// des charges). Seul un signalement + modération Fondateur pourrait le faire,
// non implémenté dans ce lot.
const ReplySchema = z.object({
  reply: z.string().min(1),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = ReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const review = await query(`SELECT id, company_id FROM reviews WHERE id = $1`, [params.id]);
  if (review.rows.length === 0 || !review.rows[0].company_id) {
    return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
  }

  const membership = await resolveMembership(session.userId, review.rows[0].company_id);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "reviews.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { rows } = await query(
    `UPDATE reviews SET company_reply = $1 WHERE id = $2 RETURNING *`,
    [parsed.data.reply, params.id]
  );

  return NextResponse.json({ review: rows[0] });
}
