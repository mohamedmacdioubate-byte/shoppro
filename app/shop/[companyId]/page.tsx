"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Product = { id: string; name: string; description: string | null; base_price: string; professional_price: string | null; };
type CartItem = { productId: string; name: string; unitPrice: number; quantity: number };

export default function ShopPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [companyName, setCompanyName] = useState("");
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetch(`/api/shop/products?companyId=${companyId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "Impossible de charger la boutique"); return; }
        setCompanyName(data.company?.name ?? "");
        setWarehouseId(data.warehouseId ?? null);
        setProducts(data.products ?? []);
      })
      .catch(() => setError("Impossible de contacter le serveur"));
    const saved = sessionStorage.getItem(`cart:${companyId}`);
    if (saved) setCart(JSON.parse(saved));
  }, [companyId, router]);

  function addToCart(p: Product) {
    setCart((prev) => {
      const price = Number(p.base_price);
      const existing = prev.find((i) => i.productId === p.id);
      const next = existing ? prev.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i)) : [...prev, { productId: p.id, name: p.name, unitPrice: price, quantity: 1 }];
      sessionStorage.setItem(`cart:${companyId}`, JSON.stringify(next));
      return next;
    });
  }
  function removeFromCart(productId: string) {
    setCart((prev) => { const next = prev.filter((i) => i.productId !== productId); sessionStorage.setItem(`cart:${companyId}`, JSON.stringify(next)); return next; });
  }
  function goToCheckout() {
    if (!warehouseId) { setError("Cette entreprise n'a pas encore de dépôt configuré."); return; }
    sessionStorage.setItem(`cart:${companyId}`, JSON.stringify(cart));
    sessionStorage.setItem(`warehouse:${companyId}`, warehouseId);
    router.push(`/checkout?companyId=${companyId}`);
  }

  const total = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}><Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Retour au tableau de bord</Link></div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{companyName || "Boutique"}</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>Catalogue disponible à la commande</div>
      {error && <div className="error-text">{error}</div>}
      {products === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
      {products?.length === 0 && <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Aucun produit disponible.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {products?.map((p) => (
            <div key={p.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontWeight: 600 }}>{p.name}</div>{p.description && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{p.description}</div>}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontWeight: 700 }}>{Number(p.base_price).toLocaleString("fr-FR")} GNF</div>
                <button className="btn" onClick={() => addToCart(p)}>Ajouter</button>
              </div>
            </div>
          ))}
        </div>
        <div className="panel">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Panier</div>
          {cart.length === 0 && <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Panier vide</div>}
          {cart.map((i) => (
            <div key={i.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
              <span>{i.name} × {i.quantity}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{(i.unitPrice * i.quantity).toLocaleString("fr-FR")} GNF
                <span onClick={() => removeFromCart(i.productId)} style={{ color: "var(--red)", cursor: "pointer", fontSize: 12 }}>✕</span>
              </span>
            </div>
          ))}
          {cart.length > 0 && (
            <>
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>Total</span><span>{total.toLocaleString("fr-FR")} GNF</span></div>
              <button className="btn block" style={{ marginTop: 14 }} onClick={goToCheckout}>Commander</button>
            </>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24, maxWidth: 500 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Laisser un avis sur cette entreprise</div>
        <ReviewForm companyId={companyId} />
      </div>
    </main>
  );
}

function ReviewForm({ companyId }: { companyId: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setReviewError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId, targetType: "service", rating, comment: comment || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setReviewError(data.error ?? "Impossible d'envoyer votre avis");
        return;
      }
      setSent(true);
    } catch {
      setReviewError("Impossible de contacter le serveur");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) return <div style={{ color: "var(--green)", fontSize: 13 }}>Merci pour votre avis !</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10, fontSize: 20, cursor: "pointer" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} onClick={() => setRating(n)} style={{ color: n <= rating ? "var(--orange)" : "var(--border-light)" }}>★</span>
        ))}
      </div>
      <div className="field">
        <textarea rows={3} placeholder="Votre commentaire (optionnel)" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {reviewError && <div className="error-text">{reviewError}</div>}
      <button className="btn" disabled={submitting} onClick={submit}>
        {submitting ? "Envoi..." : "Envoyer mon avis"}
      </button>
    </div>
  );
}
