import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership, hasPermission } from "@/lib/tenant";

const AssignSchema = z.object({
  driverId: z.string().uuid(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = AssignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const delivery = await query(`SELECT id, company_id FROM deliveries WHERE id = $1`, [params.id]);
  if (delivery.rows.length === 0) {
    return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
  }
  const companyId = delivery.rows[0].company_id;

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "deliveries.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  // Le livreur doit être actif pour CETTE entreprise précise — empêche
  // d'affecter un livreur d'une autre entreprise par erreur ou requête forgée.
  const activeDriver = await query(
    `SELECT id FROM company_drivers WHERE company_id = $1 AND driver_id = $2 AND status = 'actif'`,
    [companyId, parsed.data.driverId]
  );
  if (activeDriver.rows.length === 0) {
    return NextResponse.json({ error: "Ce livreur n'est pas actif pour cette entreprise" }, { status: 400 });
  }

  const { rows } = await query(
    `UPDATE deliveries
     SET driver_id = $1, status = 'livreur_affecte', accepted_at = now()
     WHERE id = $2 RETURNING *`,
    [parsed.data.driverId, params.id]
  );

  return NextResponse.json({ delivery: rows[0] });
}
