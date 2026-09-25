import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership } from "@/lib/tenant";

// GET ?companyId=...  → vue entreprise (toutes les candidatures reçues)
// GET ?mine=1         → vue livreur (ses propres candidatures, tous statuts)
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const mine = searchParams.get("mine");

  if (companyId) {
    const membership = await resolveMembership(session.userId, companyId);
    if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

    const { rows } = await query(
      `SELECT da.id, da.status, da.created_at,
              d.id AS driver_id, d.vehicle_type, d.vehicle_plate, d.rating,
              u.full_name AS driver_name, u.phone AS driver_phone
       FROM driver_applications da
       JOIN drivers d ON d.id = da.driver_id
       JOIN users u ON u.id = d.user_id
       WHERE da.company_id = $1
       ORDER BY da.created_at DESC`,
      [companyId]
    );
    return NextResponse.json({ applications: rows });
  }

  if (mine) {
    const driver = await query(`SELECT id FROM drivers WHERE user_id = $1`, [session.userId]);
    if (driver.rows.length === 0) return NextResponse.json({ applications: [] });

    const { rows } = await query(
      `SELECT da.id, da.status, da.created_at, c.id AS company_id, c.name AS company_name
       FROM driver_applications da
       JOIN companies c ON c.id = da.company_id
       WHERE da.driver_id = $1
       ORDER BY da.created_at DESC`,
      [driver.rows[0].id]
    );
    return NextResponse.json({ applications: rows });
  }

  return NextResponse.json({ error: "companyId ou mine requis" }, { status: 400 });
}

const ApplySchema = z.object({
  companyId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let driver = await query(`SELECT id FROM drivers WHERE user_id = $1`, [session.userId]);
  if (driver.rows.length === 0) {
    driver = await query(`INSERT INTO drivers (user_id) VALUES ($1) RETURNING id`, [session.userId]);
  }
  const driverId = driver.rows[0].id;

  const existing = await query(
    `SELECT id, status FROM driver_applications WHERE driver_id = $1 AND company_id = $2`,
    [driverId, parsed.data.companyId]
  );
  if (existing.rows.length > 0) {
    return NextResponse.json({ application: existing.rows[0] });
  }

  const { rows } = await query(
    `INSERT INTO driver_applications (driver_id, company_id) VALUES ($1, $2) RETURNING id, status`,
    [driverId, parsed.data.companyId]
  );

  return NextResponse.json({ application: rows[0] }, { status: 201 });
}
