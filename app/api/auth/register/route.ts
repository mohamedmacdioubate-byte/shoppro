import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { hashPassword, signSession } from "@/lib/auth";

const RegisterSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  password: z.string().min(8),
}).refine((d) => d.email || d.phone, {
  message: "Email ou téléphone requis",
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { fullName, email, phone, password } = parsed.data;

  const existing = await query(
    `SELECT id FROM users WHERE email = $1 OR phone = $2`,
    [email ?? null, phone ?? null]
  );
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: "Un compte existe déjà avec ces identifiants" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  // is_founder n'est jamais défini ici : il ne peut être positionné que
  // manuellement en base, jamais via cette route publique.
  const { rows } = await query<{ id: string }>(
    `INSERT INTO users (full_name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [fullName, email ?? null, phone ?? null, passwordHash]
  );

  const token = signSession({ userId: rows[0].id, isFounder: false });
  return NextResponse.json({ token }, { status: 201 });
}
