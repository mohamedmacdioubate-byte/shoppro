import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership } from "@/lib/tenant";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const platform = searchParams.get("platform");

  if (platform) {
    const { rows } = await query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name AS reviewer_name
       FROM reviews r JOIN users u ON u.id = r.reviewer_id
       WHERE r.target_type = 'plateforme'
       ORDER BY r.created_at DESC`
    );
    return NextResponse.json({ reviews: rows });
  }

  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  const { rows } = await query(
    `SELECT r.id, r.rating, r.comment, r.company_reply, r.created_at, u.full_name AS reviewer_name
     FROM reviews r JOIN users u ON u.id = r.reviewer_id
     WHERE r.company_id = $1 AND r.target_type = 'service'
     ORDER BY r.created_at DESC`,
    [companyId]
  );

  return NextResponse.json({ reviews: rows });
}

const CreateReviewSchema = z.object({
  companyId: z.string().uuid().optional(),
  targetType: z.enum(["service", "plateforme"]),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
}).refine((d) => d.targetType === "plateforme" || Boolean(d.companyId), {
  message: "companyId requis pour un avis service",
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const { rows } = await query(
    `INSERT INTO reviews (target_type, company_id, reviewer_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.targetType, data.targetType === "plateforme" ? null : data.companyId, session.userId, data.rating, data.comment ?? null]
  );

  return NextResponse.json({ review: rows[0] }, { status: 201 });
}
