import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership } from "@/lib/tenant";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  const roles = await query(
    `SELECT id, name, is_director FROM roles WHERE company_id = $1 ORDER BY is_director DESC, name`,
    [companyId]
  );
  const allPermissions = await query(`SELECT id, code, label FROM permissions ORDER BY label`);
  const granted = await query(
    `SELECT role_id, permission_id FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id WHERE r.company_id = $1`,
    [companyId]
  );

  const grantedByRole = new Map<string, Set<string>>();
  for (const g of granted.rows) {
    if (!grantedByRole.has(g.role_id)) grantedByRole.set(g.role_id, new Set());
    grantedByRole.get(g.role_id)!.add(g.permission_id);
  }

  return NextResponse.json({
    roles: roles.rows.map((r) => ({
      ...r,
      permissionIds: r.is_director ? allPermissions.rows.map((p) => p.id) : Array.from(grantedByRole.get(r.id) ?? []),
    })),
    permissions: allPermissions.rows,
  });
}
