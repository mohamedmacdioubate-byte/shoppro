import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// Liste les entreprises auxquelles l'utilisateur connecté appartient,
// avec son rôle dans chacune (permet le sélecteur "changer d'entreprise").
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { rows } = await query(
    `SELECT c.id, c.name, c.status, c.logo_url, r.name AS role_name, r.is_director
     FROM company_members cm
     JOIN companies c ON c.id = cm.company_id
     JOIN roles r ON r.id = cm.role_id
     WHERE cm.user_id = $1 AND cm.status = 'actif'
     ORDER BY c.name`,
    [session.userId]
  );

  return NextResponse.json({ companies: rows });
}

const CreateCompanySchema = z.object({
  name: z.string().min(2),
  sector: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  city: z.string().optional(),
});

// Inscription d'une nouvelle entreprise. Elle est créée avec le statut
// 'en_attente' — elle ne devient utilisable qu'après validation Fondateur
// (voir section 30 du cahier des charges : pas d'accès immédiat aux
// fonctionnalités professionnelles).
export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const client = await (await import("@/lib/db")).pool.connect();
  try {
    await client.query("BEGIN");

    const companyRes = await client.query(
      `INSERT INTO companies (name, sector, phone, email, city, status)
       VALUES ($1, $2, $3, $4, $5, 'en_attente') RETURNING id`,
      [parsed.data.name, parsed.data.sector ?? null, parsed.data.phone ?? null,
       parsed.data.email ?? null, parsed.data.city ?? null]
    );
    const companyId = companyRes.rows[0].id;

    const roleRes = await client.query(
      `INSERT INTO roles (company_id, name, is_director) VALUES ($1, 'Directeur', TRUE) RETURNING id`,
      [companyId]
    );

    await client.query(
      `INSERT INTO company_members (company_id, user_id, role_id) VALUES ($1, $2, $3)`,
      [companyId, session.userId, roleRes.rows[0].id]
    );

    await client.query("COMMIT");
    return NextResponse.json({ companyId, status: "en_attente" }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
