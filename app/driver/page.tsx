"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Delivery = {
  id: string;
  status: string;
  distance_km: string | null;
  order_number: string;
  total: string;
  company_name: string;
  customer_name: string;
  customer_phone: string | null;
  address_line: string | null;
  commune: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  commande_acceptee: "Commande acceptée",
  preparation: "En préparation",
  livreur_affecte: "Affectée à vous",
  en_route: "En route",
  livraison_en_cours: "Livraison en cours",
  livree: "Livrée",
  annulee: "Annulée",
};

// Prochaine étape que le livreur peut déclencher, par statut actuel.
const NEXT_STEP: Record<string, { next: string; label: string } | undefined> = {
  livreur_affecte: { next: "en_route", label: "Démarrer (en route)" },
  en_route: { next: "livraison_en_cours", label: "Livraison en cours" },
  livraison_en_cours: { next: "livree", label: "Marquer comme livrée" },
};

export default function DriverDeliveriesPage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push("/login");
      return;
    }
    const res = await fetch("/api/driver/deliveries", { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) {
      localStorage.removeItem("token");
      router.push("/login");
      return;
    }
    const data = await res.json();
    setDeliveries(data.deliveries ?? []);
  }, [router]);

  useEffect(() => {
    load().catch(() => setError("Impossible de charger vos livraisons"));
  }, [load]);

  async function advance(deliveryId: string, nextStatus: string) {
    setUpdating(deliveryId);
    try {
      const res = await fetch(`/api/driver/deliveries/${deliveryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Impossible de mettre à jour le statut");
        return;
      }
      await load();
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setUpdating(null);
    }
  }

  const active = deliveries?.filter((d) => !["livree", "annulee"].includes(d.status)) ?? [];
  const done = deliveries?.filter((d) => ["livree", "annulee"].includes(d.status)) ?? [];

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
        <Link href="/drivers/apply" style={{ color: "var(--blue)", fontSize: 13, fontWeight: 600 }}>
          Postuler à une entreprise →
        </Link>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🚚 Mes livraisons</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Livraisons qui vous sont affectées
      </div>

      {error && <div className="error-text">{error}</div>}

      {deliveries === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}

      {active.length === 0 && deliveries !== null && (
        <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: 20 }}>
          Aucune livraison en cours pour le moment.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {active.map((d) => {
          const step = NEXT_STEP[d.status];
          return (
            <div key={d.id} className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{d.order_number}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{d.company_name}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: "var(--blue-dim)", color: "#8fb8fb" }}>
                  {STATUS_LABELS[d.status] ?? d.status}
                </span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>👤 {d.customer_name} {d.customer_phone ? `· ${d.customer_phone}` : ""}</div>
              {d.address_line && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                  📍 {d.address_line}{d.commune ? `, ${d.commune}` : ""}
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{Number(d.total).toLocaleString("fr-FR")} GNF</div>
              {step && (
                <button className="btn block" disabled={updating === d.id} onClick={() => advance(d.id, step.next)}>
                  {updating === d.id ? "..." : step.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {done.length > 0 && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>Historique</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {done.map((d) => (
              <div key={d.id} className="panel" style={{ display: "flex", justifyContent: "space-between", opacity: 0.7 }}>
                <span>{d.order_number} · {d.company_name}</span>
                <span style={{ color: d.status === "livree" ? "var(--green)" : "var(--red)" }}>
                  {STATUS_LABELS[d.status]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
