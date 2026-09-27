import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership, hasPermission } from "@/lib/tenant";

const AddMemberSchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = AddMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const group = await query(`SELECT id, company_id FROM groups WHERE id = $1`, [params.id]);
  if (group.rows.length === 0) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }
  const companyId = group.rows[0].company_id;

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "groups.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  // La personne ajoutée doit elle-même appartenir à l'entreprise.
  const target = await query(
    `SELECT id FROM company_members WHERE company_id = $1 AND user_id = $2`,
    [companyId, parsed.data.userId]
  );
  if (target.rows.length === 0) {
    return NextResponse.json({ error: "Cette personne ne fait pas partie de l'entreprise" }, { status: 400 });
  }

  await query(
    `INSERT INTO group_members (group_id, user_id, can_post) VALUES ($1, $2, TRUE)
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [params.id, parsed.data.userId]
  );

  return NextResponse.json({ success: true }, { status: 201 });
}
