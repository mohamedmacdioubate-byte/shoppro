"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Invoice = { id: string; number: string; amount: string; issued_at: string; company_name: string; order_number: string | null };

export default function MyInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }
    const res = await fetch("/api/invoices?mine=1", { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    const data = await res.json();
    setInvoices(data.invoices ?? []);
  }, [router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger vos factures")); }, [load]);

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🧾 Mes factures</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Toutes vos commandes, tous marchands confondus
      </div>

      {error && <div className="error-text">{error}</div>}
      {invoices === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
      {invoices?.length === 0 && (
        <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Aucune facture pour le moment.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {invoices?.map((i) => (
          <div key={i.id} className="panel" style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{i.number}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {i.company_name} · {new Date(i.issued_at).toLocaleDateString("fr-FR")}
              </div>
            </div>
            <div style={{ fontWeight: 700 }}>{Number(i.amount).toLocaleString("fr-FR")} GNF</div>
          </div>
        ))}
      </div>
    </main>
  );
}
