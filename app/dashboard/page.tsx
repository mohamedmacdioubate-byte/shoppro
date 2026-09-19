"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  status: string;
  role_name: string;
  is_director: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetch("/api/companies", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
        const data = await res.json();
        setCompanies(data.companies ?? []);
      })
      .catch(() => setError("Impossible de charger vos entreprises"));
  }, [router]);

  function logout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Mes entreprises</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/companies/new" className="btn">+ Créer mon entreprise</Link>
          <button
            className="btn"
            onClick={logout}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      {companies === null && !error && (
        <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>
      )}

      {companies?.length === 0 && (
        <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Vous n&apos;êtes rattaché à aucune entreprise pour le moment.
          <div style={{ marginTop: 14 }}>
            <Link href="/companies/new" className="btn">Créer ma première entreprise</Link>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {companies?.map((c) => (
          <div key={c.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{c.role_name}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link href={`/companies/${c.id}/products`} style={{ fontSize: 12.5, color: "var(--blue)", fontWeight: 600 }}>
                Gérer les produits
              </Link>
              <Link href={`/shop/${c.id}`} style={{ fontSize: 12.5, color: "var(--blue)", fontWeight: 600 }}>
                Voir la boutique
              </Link>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: c.status === "active" ? "var(--green-dim)" : "var(--orange, #F59E0B)",
                  color: c.status === "active" ? "var(--green)" : "#0a0e17",
                }}
              >
                {c.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
