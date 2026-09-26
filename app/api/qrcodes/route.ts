import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
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
    `SELECT id, code, target_type, active, scan_count, created_at
     FROM qr_codes WHERE company_id = $1 ORDER BY created_at DESC`,
    [companyId]
  );

  return NextResponse.json({ qrCodes: rows });
}

const CreateQrSchema = z.object({
  companyId: z.string().uuid(),
  targetType: z.enum(["page_publique", "catalogue", "promotion", "recrutement", "fidelite"]),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateQrSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const membership = await resolveMembership(session.userId, data.companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "qrcodes.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const code = randomBytes(6).toString("hex");

  const qrCode = await withTenant(data.companyId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO qr_codes (company_id, code, target_type, target_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.companyId, code, data.targetType, data.companyId]
    );
    return rows[0];
  });

  return NextResponse.json({ qrCode }, { status: 201 });
}
