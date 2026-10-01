import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership } from "@/lib/tenant";

// Renvoie ce que l'utilisateur a le droit de voir/faire dans CETTE
// entreprise précise. C'est sur cette réponse que la page hub
// /companies/[id] se base pour n'afficher que les sections autorisées —
// jamais une liste complète affichée puis filtrée côté client seulement.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const membership = await resolveMembership(session.userId, params.id);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  return NextResponse.json({
    roleName: membership.roleName,
    isDirector: membership.isDirector,
    permissions: membership.permissions,
  });
}
