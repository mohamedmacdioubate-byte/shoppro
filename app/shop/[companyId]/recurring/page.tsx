"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";

type CartItem = { productId: string; name: string; unitPrice: number; quantity: number };

export default function RecurringSetupPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<"quotidienne" | "hebdomadaire" | "mensuelle" | "personnalisee">("hebdomadaire");
  const [customDays, setCustomDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const savedCart = sessionStorage.getItem(`cart:${companyId}`);
    const savedWarehouse = sessionStorage.getItem(`warehouse:${companyId}`);
    if (!savedCart || JSON.parse(savedCart).length === 0) {
      router.push(`/shop/${companyId}`);
      return;
    }
    setCart(JSON.parse(savedCart));
    setWarehouseId(savedWarehouse);
  }, [companyId, router]);

  async function submit() {
    if (!warehouseId) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/recurring-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyId,
          warehouseId,
          frequency,
          customDays: frequency === "personnalisee" ? Number(customDays) : undefined,
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, name: i.name })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(extractErrorMessage(data.error));
        return;
      }
      sessionStorage.removeItem(`cart:${companyId}`);
      setDone(true);
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="panel" style={{ width: 400, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Commande récurrente programmée</div>
          <Link href="/dashboard" className="btn block">Retour au tableau de bord</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/shop/${companyId}`} style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Retour à la boutique</Link>
      </div>

      <div className="serif" style={{ fontSize: 22, fontWeight: 700, marginBottom: 20  }}>Programmer une commande récurrente</div>

      <div className="panel" style={{ marginBottom: 16 }}>
        {cart.map((i) => (
          <div key={i.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span>{i.name} × {i.quantity}</span>
            <span>{(i.unitPrice * i.quantity).toLocaleString("fr-FR")} GNF</span>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Fréquence</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)}>
            <option value="quotidienne">Quotidienne</option>
            <option value="hebdomadaire">Hebdomadaire</option>
            <option value="mensuelle">Mensuelle</option>
            <option value="personnalisee">Personnalisée</option>
          </select>
        </div>
        {frequency === "personnalisee" && (
          <div className="field">
            <label>Tous les combien de jours ?</label>
            <input type="number" min="1" value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
          La commande sera générée automatiquement chaque jour à 6h (heure UTC) une fois la date atteinte.
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <button className="btn block" disabled={submitting} onClick={submit}>
        {submitting ? "Programmation..." : "Programmer"}
      </button>
    </main>
  );
}
