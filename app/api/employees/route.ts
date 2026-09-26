import { NextResponse } from "next/server";
import { z } from "zod";
import { query, withTenant } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership, hasPermission } from "@/lib/tenant";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  const { rows } = await query(
    `SELECT cm.id, cm.status, cm.joined_at, u.full_name, u.email, r.name AS role_name, r.is_director
     FROM company_members cm
     JOIN users u ON u.id = cm.user_id
     JOIN roles r ON r.id = cm.role_id
     WHERE cm.company_id = $1
     ORDER BY r.is_director DESC, u.full_name`,
    [companyId]
  );

  return NextResponse.json({ employees: rows });
}

// Simplification volontaire : pas de flux d'invitation par email — la
// personne doit déjà avoir un compte ShopPro (créé via /register), et le
// Directeur l'ajoute directement en tapant son email et un nom de rôle.
// Un vrai système d'invitation (lien, expiration) reste à construire.
const AddEmployeeSchema = z.object({
  companyId: z.string().uuid(),
  email: z.string().email(),
  roleName: z.string().min(2),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = AddEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const membership = await resolveMembership(session.userId, data.companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "employees.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const user = await query(`SELECT id FROM users WHERE email = $1`, [data.email]);
  if (user.rows.length === 0) {
    return NextResponse.json({ error: "Aucun compte ShopPro n'existe avec cet email — la personne doit d'abord créer un compte" }, { status: 404 });
  }
  const userId = user.rows[0].id;

  try {
    const member = await withTenant(data.companyId, async (client) => {
      let role = await client.query(
        `SELECT id FROM roles WHERE company_id = $1 AND name = $2`,
        [data.companyId, data.roleName]
      );
      if (role.rows.length === 0) {
        role = await client.query(
          `INSERT INTO roles (company_id, name, is_director) VALUES ($1, $2, FALSE) RETURNING id`,
          [data.companyId, data.roleName]
        );
      }

      const existing = await client.query(
        `SELECT id FROM company_members WHERE company_id = $1 AND user_id = $2`,
        [data.companyId, userId]
      );
      if (existing.rows.length > 0) {
        throw new Error("Cette personne fait déjà partie de l'entreprise");
      }

      const res = await client.query(
        `INSERT INTO company_members (company_id, user_id, role_id, invited_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [data.companyId, userId, role.rows[0].id, session.userId]
      );

      await client.query(
        `INSERT INTO notifications (user_id, company_id, type, title, body)
         VALUES ($1, $2, 'nouvelle_candidature', 'Ajouté à une équipe', $3)`,
        [userId, data.companyId, `Vous avez rejoint l'entreprise en tant que ${data.roleName}`]
      );

      return res.rows[0];
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Impossible d'ajouter cet employé" }, { status: 400 });
  }
}
