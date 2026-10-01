import { NextResponse } from "next/server";
import { z } from "zod";
import { query, withTenant } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership } from "@/lib/tenant";

const UpdateRoleSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
});

// Volontairement réservé au Directeur — PAS géré via hasPermission comme
// les autres routes. Si un manager pouvait modifier les permissions,
// il pourrait s'octroyer lui-même des droits supplémentaires. Seul le
// Directeur (is_director en base, jamais modifiable par ce chemin) peut
// changer qui a accès à quoi.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = UpdateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const role = await query(`SELECT id, company_id, is_director FROM roles WHERE id = $1`, [params.id]);
  if (role.rows.length === 0) {
    return NextResponse.json({ error: "Rôle introuvable" }, { status: 404 });
  }
  if (role.rows[0].is_director) {
    return NextResponse.json({ error: "Le rôle Directeur a toujours tous les droits, non modifiable" }, { status: 400 });
  }

  const membership = await resolveMembership(session.userId, role.rows[0].company_id);
  if (!membership?.isDirector) {
    return NextResponse.json({ error: "Seul le Directeur peut modifier les permissions" }, { status: 403 });
  }

  await withTenant(role.rows[0].company_id, async (client) => {
    await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [params.id]);
    for (const permissionId of parsed.data.permissionIds) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
        [params.id, permissionId]
      );
    }
  });

  return NextResponse.json({ success: true });
}
