"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Delivery = {
  id: string;
  status: string;
  driver_id: string | null;
  order_number: string;
  total: string;
  customer_name: string;
  driver_name: string | null;
};
type DriverOption = { id: string; full_name: string };

const STATUS_LABELS: Record<string, string> = {
  commande_acceptee: "Commande acceptée",
  preparation: "En préparation",
  livreur_affecte: "Livreur affecté",
  en_route: "En route",
  livraison_en_cours: "Livraison en cours",
  livree: "Livrée",
  annulee: "Annulée",
};

export default function CompanyDeliveriesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push("/login");
      return;
    }
    const res = await fetch(`/api/deliveries?companyId=${companyId}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.status === 401) {
      localStorage.removeItem("token");
      router.push("/login");
      return;
    }
    const data = await res.json();
    setDeliveries(data.deliveries ?? []);
    setDrivers(data.availableDrivers ?? []);
  }, [companyId, router]);

  useEffect(() => {
    load().catch(() => setError("Impossible de charger les livraisons"));
  }, [load]);

  async function assign(deliveryId: string, driverId: string) {
    if (!driverId) return;
    setAssigning(deliveryId);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ driverId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Impossible d'affecter ce livreur");
        return;
      }
      await load();
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setAssigning(null);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
        <Link href={`/companies/${companyId}/drivers`} style={{ color: "var(--blue)", fontSize: 13, fontWeight: 600 }}>
          Gérer les livreurs →
        </Link>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Livraisons</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Suivi et affectation des livraisons
      </div>

      {error && <div className="error-text">{error}</div>}

      {drivers.length === 0 && (
        <div className="panel" style={{ marginBottom: 20, color: "var(--text-secondary)" }}>
          Aucun livreur actif pour le moment. <Link href={`/companies/${companyId}/drivers`} style={{ color: "var(--blue)" }}>Acceptez des candidatures</Link> pour pouvoir affecter des livraisons.
        </div>
      )}

      {deliveries === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}

      {deliveries?.length === 0 && (
        <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Aucune livraison pour le moment.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {deliveries?.map((d) => (
          <div key={d.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{d.order_number}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{d.customer_name} · {Number(d.total).toLocaleString("fr-FR")} GNF</div>
              <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: "var(--blue-dim)", color: "#8fb8fb" }}>
                {STATUS_LABELS[d.status] ?? d.status}
              </span>
            </div>
            <div>
              {d.driver_name ? (
                <div style={{ fontSize: 13 }}>🚚 {d.driver_name}</div>
              ) : (
                <select
                  defaultValue=""
                  disabled={assigning === d.id || drivers.length === 0}
                  onChange={(e) => assign(d.id, e.target.value)}
                >
                  <option value="" disabled>Affecter un livreur...</option>
                  {drivers.map((dr) => <option key={dr.id} value={dr.id}>{dr.full_name}</option>)}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
