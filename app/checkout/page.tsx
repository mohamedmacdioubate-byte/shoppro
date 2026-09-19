"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type CartItem = { productId: string; name: string; unitPrice: number; quantity: number };

// useSearchParams() exige une frontière Suspense en App Router — sans elle,
// le build échoue sur cette page.
export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"especes_a_la_livraison" | "orange_money">("especes_a_la_livraison");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{ order_number: string; total: string } | null>(null);

  useEffect(() => {
    if (!companyId) {
      router.push("/dashboard");
      return;
    }
    const savedCart = sessionStorage.getItem(`cart:${companyId}`);
    const savedWarehouse = sessionStorage.getItem(`warehouse:${companyId}`);
    if (!savedCart || JSON.parse(savedCart).length === 0) {
      router.push(`/shop/${companyId}`);
      return;
    }
    setCart(JSON.parse(savedCart));
    setWarehouseId(savedWarehouse);
  }, [companyId, router]);

  const deliveryFee = 10000;
  const subtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const total = subtotal + deliveryFee;

  async function handleConfirm() {
    if (!companyId || !warehouseId) return;
    setError(null);
    setSubmitting(true);
    const token = localStorage.getItem("token");

    try {
      // 1. S'assurer que le profil client existe pour cette entreprise
      const custRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId }),
      });
      const custData = await custRes.json();
      if (!custRes.ok) {
        setError(custData.error ?? "Impossible de créer votre profil client");
        return;
      }

      // 2. Créer la commande
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyId,
          customerId: custData.customerId,
          warehouseId,
          deliveryFee,
          paymentMethod,
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setError(orderData.error ?? "Impossible de créer la commande");
        return;
      }

      sessionStorage.removeItem(`cart:${companyId}`);
      setConfirmedOrder(orderData.order);
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedOrder) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="panel" style={{ width: 420, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Commande confirmée</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 18 }}>
            Numéro : {confirmedOrder.order_number}<br />
            Total : {Number(confirmedOrder.total).toLocaleString("fr-FR")} GNF
          </div>
          <Link href="/dashboard" className="btn block">Retour au tableau de bord</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        {companyId && (
          <Link href={`/shop/${companyId}`} style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            ← Retour à la boutique
          </Link>
        )}
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Confirmer la commande</div>

      <div className="panel" style={{ marginBottom: 16 }}>
        {cart.map((i) => (
          <div key={i.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <span>{i.name} × {i.quantity}</span>
            <span>{(i.unitPrice * i.quantity).toLocaleString("fr-FR")} GNF</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)" }}>
            <span>Livraison</span><span>{deliveryFee.toLocaleString("fr-FR")} GNF</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 6 }}>
            <span>Total</span><span>{total.toLocaleString("fr-FR")} GNF</span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Mode de paiement</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13 }}>
          <input
            type="radio"
            checked={paymentMethod === "especes_a_la_livraison"}
            onChange={() => setPaymentMethod("especes_a_la_livraison")}
          />
          Espèces à la livraison
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="radio"
            checked={paymentMethod === "orange_money"}
            onChange={() => setPaymentMethod("orange_money")}
          />
          Orange Money
        </label>
      </div>

      {error && <div className="error-text">{error}</div>}

      <button className="btn block" disabled={submitting} onClick={handleConfirm}>
        {submitting ? "Traitement..." : `Confirmer — ${total.toLocaleString("fr-FR")} GNF`}
      </button>
    </main>
  );
}
