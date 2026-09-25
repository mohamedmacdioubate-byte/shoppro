import { NextResponse } from "next/server";
import { z } from "zod";
import { query, withTenant } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership, hasPermission } from "@/lib/tenant";

const DecisionSchema = z.object({
  status: z.enum(["acceptee", "refusee"]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const app = await query(
    `SELECT id, driver_id, company_id FROM driver_applications WHERE id = $1`,
    [params.id]
  );
  if (app.rows.length === 0) {
    return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
  }
  const application = app.rows[0];

  const membership = await resolveMembership(session.userId, application.company_id);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "drivers.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const updated = await withTenant(application.company_id, async (client) => {
    const res = await client.query(
      `UPDATE driver_applications
       SET status = $1, reviewed_by = $2, reviewed_at = now()
       WHERE id = $3 RETURNING *`,
      [parsed.data.status, session.userId, params.id]
    );

    if (parsed.data.status === "acceptee") {
      await client.query(
        `INSERT INTO company_drivers (company_id, driver_id) VALUES ($1, $2)
         ON CONFLICT (company_id, driver_id) DO UPDATE SET status = 'actif'`,
        [application.company_id, application.driver_id]
      );
    }

    return res.rows[0];
  });

  return NextResponse.json({ application: updated });
}
