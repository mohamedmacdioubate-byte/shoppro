import { NextResponse } from "next/server";
import { z } from "zod";
import { query, withTenant } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership, hasPermission } from "@/lib/tenant";

// Simplification : tout membre de l'entreprise peut voir la liste des
// groupes (pas seulement ceux dont il est membre) — une vraie gestion de
// visibilité par groupe reste à affiner si besoin.
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  const { rows } = await query(
    `SELECT g.id, g.name, g.type, g.created_at,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
            EXISTS(SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = $2) AS is_member
     FROM groups g
     WHERE g.company_id = $1
     ORDER BY g.created_at DESC`,
    [companyId, session.userId]
  );

  return NextResponse.json({ groups: rows });
}

const CreateGroupSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(2),
  type: z.enum(["livraison", "stock", "production", "direction", "general", "commercial"]).default("general"),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const membership = await resolveMembership(session.userId, data.companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "groups.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const group = await withTenant(data.companyId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO groups (company_id, name, type, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.companyId, data.name, data.type, session.userId]
    );
    await client.query(
      `INSERT INTO group_members (group_id, user_id, can_post) VALUES ($1, $2, TRUE)`,
      [rows[0].id, session.userId]
    );
    return rows[0];
  });

  return NextResponse.json({ group }, { status: 201 });
}
