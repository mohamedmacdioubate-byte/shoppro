"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";

type Product = { id: string; name: string; base_price: string; professional_price: string | null; category_name: string | null; status: string; };

export default function CompanyProductsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [professionalPrice, setProfessionalPrice] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const res = await fetch(`/api/products?companyId=${companyId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    if (res.status === 403) { setError("Vous n'avez pas accès à cette entreprise"); return; }
    const data = await res.json();
    setProducts(data.products ?? []);
  }, [companyId, router]);

  useEffect(() => { loadProducts().catch(() => setError("Impossible de charger les produits")); }, [loadProducts]);

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null); setSubmitting(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/products", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId, name, description: description || undefined, basePrice: Number(basePrice), professionalPrice: professionalPrice ? Number(professionalPrice) : undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(extractErrorMessage(data.error)); return; }
      setName(""); setBasePrice(""); setProfessionalPrice(""); setDescription("");
      await loadProducts();
    } catch { setFormError("Impossible de contacter le serveur"); } finally { setSubmitting(false); }
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}><Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Retour au tableau de bord</Link></div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Produits</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>Catalogue de votre entreprise</div>
      {error && <div className="error-text">{error}</div>}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>Ajouter un produit</div>
        <form onSubmit={handleAddProduct}>
          <div className="field"><label>Nom du produit</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="field" style={{ flex: 1 }}><label>Prix particulier (GNF)</label><input type="number" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required /></div>
            <div className="field" style={{ flex: 1 }}><label>Prix professionnel (optionnel)</label><input type="number" min="0" value={professionalPrice} onChange={(e) => setProfessionalPrice(e.target.value)} /></div>
          </div>
          <div className="field"><label>Description (optionnel)</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {formError && <div className="error-text">{formError}</div>}
          <button className="btn" disabled={submitting} type="submit">{submitting ? "Ajout..." : "Ajouter le produit"}</button>
        </form>
      </div>
      {products === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
      {products?.length === 0 && <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Aucun produit pour le moment.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {products?.map((p) => (
          <div key={p.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.category_name ?? "Sans catégorie"}</div></div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>{Number(p.base_price).toLocaleString("fr-FR")} GNF</div>
              {p.professional_price && <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>Pro : {Number(p.professional_price).toLocaleString("fr-FR")} GNF</div>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
