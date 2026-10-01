"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Access = { roleName: string; isDirector: boolean; permissions: string[] };

type Section = { href: string; label: string; icon: string; permission: string | null };

const SECTIONS: Section[] = [
  { href: "products", label: "Produits", icon: "📦", permission: "products.manage" },
  { href: "warehouses", label: "Dépôts", icon: "🏭", permission: "warehouses.manage" },
  { href: "stock", label: "Stock", icon: "📊", permission: "stock.manage" },
  { href: "drivers", label: "Livreurs", icon: "🧍", permission: "drivers.manage" },
  { href: "deliveries", label: "Livraisons", icon: "🚚", permission: "deliveries.manage" },
  { href: "promotions", label: "Promotions", icon: "🏷️", permission: "promotions.manage" },
  { href: "reviews", label: "Avis", icon: "⭐", permission: null },
  { href: "qrcodes", label: "QR Codes", icon: "🔗", permission: "qrcodes.manage" },
  { href: "employees", label: "Employés", icon: "👥", permission: "employees.manage" },
  { href: "groups", label: "Communication", icon: "💬", permission: null },
  { href: "invoices", label: "Factures", icon: "🧾", permission: null },
  { href: "recurring-orders", label: "Commandes récurrentes", icon: "🔁", permission: null },
];

export default function CompanyHubPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [companyName, setCompanyName] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }

    const [accessRes, companiesRes] = await Promise.all([
      fetch(`/api/companies/${companyId}/access`, { headers: { Authorization: `Bearer ${t}` } }),
      fetch(`/api/companies`, { headers: { Authorization: `Bearer ${t}` } }),
    ]);
    if (accessRes.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    if (accessRes.status === 403) { setError("Vous ne faites pas partie de cette entreprise"); return; }
    const accessData = await accessRes.json();
    const companiesData = await companiesRes.json();
    setAccess(accessData);
    setCompanyName(companiesData.companies?.find((c: any) => c.id === companyId)?.name ?? "");
  }, [companyId, router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger l'entreprise")); }, [load]);

  const canSee = (permission: string | null) =>
    !access ? false : access.isDirector || permission === null || access.permissions.includes(permission);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
      </div>

      <div className="serif" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{companyName || "Entreprise"}</div>
      {access && (
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
          Connecté en tant que <strong>{access.roleName}</strong>
        </div>
      )}

      {error && <div className="error-text">{error}</div>}

      {access && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {SECTIONS.filter((s) => canSee(s.permission)).map((s) => (
            <Link key={s.href} href={`/companies/${companyId}/${s.href}`} className="panel" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{s.label}</span>
            </Link>
          ))}
          {access.isDirector && (
            <Link href={`/companies/${companyId}/roles`} className="panel" style={{ display: "flex", alignItems: "center", gap: 12, borderColor: "var(--gold)" }}>
              <span style={{ fontSize: 20 }}>🔐</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Rôles et permissions</span>
            </Link>
          )}
          <Link href={`/shop/${companyId}`} className="panel" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>🛍️</span>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Voir la boutique</span>
          </Link>
        </div>
      )}
    </main>
  );
}
