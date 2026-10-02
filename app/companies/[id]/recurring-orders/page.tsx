"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type RecurringOrder = {
  id: string; frequency: string; next_run_at: string; active: boolean;
  customer_name: string; template_items: { items: Array<{ name: string; quantity: number }> };
};

const FREQ_LABELS: Record<string, string> = {
  quotidienne: "Quotidienne", hebdomadaire: "Hebdomadaire", mensuelle: "Mensuelle", personnalisee: "Personnalisée",
};

export default function CompanyRecurringOrdersPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [orders, setOrders] = useState<RecurringOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }
    const res = await fetch(`/api/recurring-orders?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    const data = await res.json();
    setOrders(data.recurringOrders ?? []);
  }, [companyId, router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger les commandes récurrentes")); }, [load]);

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
      </div>

      <div className="serif" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4  }}>Commandes récurrentes</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Programmées par vos clients professionnels — générées automatiquement chaque jour
      </div>

      {error && <div className="error-text">{error}</div>}
      {orders === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
      {orders?.length === 0 && (
        <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Aucune commande récurrente pour le moment.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {orders?.map((o) => (
          <div key={o.id} className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>{o.customer_name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: o.active ? "var(--green-dim)" : "var(--red-dim)", color: o.active ? "var(--green)" : "var(--red)" }}>
                {o.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
              {FREQ_LABELS[o.frequency] ?? o.frequency} · prochaine le {new Date(o.next_run_at).toLocaleDateString("fr-FR")}
            </div>
            <div style={{ fontSize: 12.5 }}>
              {o.template_items?.items?.map((it) => `${it.quantity}× ${it.name}`).join(", ")}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
