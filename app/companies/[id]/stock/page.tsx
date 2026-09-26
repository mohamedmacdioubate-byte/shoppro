"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";

type InventoryRow = { id: string; quantity: number; min_threshold: number; product_id: string; product_name: string; warehouse_id: string; warehouse_name: string; };
type Warehouse = { id: string; name: string };
type Product = { id: string; name: string };

export default function StockPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;
  const [inventory, setInventory] = useState<InventoryRow[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adjustWarehouse, setAdjustWarehouse] = useState("");
  const [adjustProduct, setAdjustProduct] = useState("");
  const [adjustType, setAdjustType] = useState<"entree" | "sortie" | "ajustement">("entree");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [transferProduct, setTransferProduct] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }
    const [invRes, whRes, prodRes] = await Promise.all([
      fetch(`/api/inventory?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } }),
      fetch(`/api/warehouses?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } }),
      fetch(`/api/products?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } }),
    ]);
    if (invRes.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    setInventory((await invRes.json()).inventory ?? []);
    setWarehouses((await whRes.json()).warehouses ?? []);
    setProducts((await prodRes.json()).products ?? []);
  }, [companyId, router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger le stock")); }, [load]);

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault(); setAdjustError(null); setAdjustSubmitting(true);
    try {
      const res = await fetch("/api/inventory/adjust", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ companyId, warehouseId: adjustWarehouse, productId: adjustProduct, type: adjustType, quantity: Number(adjustQty) }) });
      const data = await res.json();
      if (!res.ok) { setAdjustError(extractErrorMessage(data.error)); return; }
      setAdjustQty(""); await load();
    } catch { setAdjustError("Impossible de contacter le serveur"); } finally { setAdjustSubmitting(false); }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault(); setTransferError(null); setTransferSubmitting(true);
    try {
      const res = await fetch("/api/inventory/transfer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ companyId, fromWarehouseId: fromWarehouse, toWarehouseId: toWarehouse, productId: transferProduct, quantity: Number(transferQty) }) });
      const data = await res.json();
      if (!res.ok) { setTransferError(extractErrorMessage(data.error)); return; }
      setTransferQty(""); await load();
    } catch { setTransferError("Impossible de contacter le serveur"); } finally { setTransferSubmitting(false); }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
        <Link href={`/companies/${companyId}/warehouses`} style={{ color: "var(--blue)", fontSize: 13, fontWeight: 600 }}>Gérer les dépôts →</Link>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Stock</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>Niveaux de stock par dépôt et par produit</div>
      {error && <div className="error-text">{error}</div>}
      {warehouses.length === 0 && <div className="panel" style={{ marginBottom: 20, color: "var(--text-secondary)" }}>Aucun dépôt. <Link href={`/companies/${companyId}/warehouses`} style={{ color: "var(--blue)" }}>Créez-en un</Link>.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="panel">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Ajuster le stock</div>
          <form onSubmit={handleAdjust}>
            <div className="field"><label>Dépôt</label><select value={adjustWarehouse} onChange={(e) => setAdjustWarehouse(e.target.value)} required><option value="">Choisir...</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
            <div className="field"><label>Produit</label><select value={adjustProduct} onChange={(e) => setAdjustProduct(e.target.value)} required><option value="">Choisir...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>Type</label><select value={adjustType} onChange={(e) => setAdjustType(e.target.value as any)}><option value="entree">Entrée</option><option value="sortie">Sortie</option><option value="ajustement">Ajustement (+)</option></select></div>
              <div className="field" style={{ flex: 1 }}><label>Quantité</label><input type="number" min="1" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} required /></div>
            </div>
            {adjustError && <div className="error-text">{adjustError}</div>}
            <button className="btn block" disabled={adjustSubmitting} type="submit">{adjustSubmitting ? "Application..." : "Appliquer"}</button>
          </form>
        </div>
        <div className="panel">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Transférer entre dépôts</div>
          <form onSubmit={handleTransfer}>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>Depuis</label><select value={fromWarehouse} onChange={(e) => setFromWarehouse(e.target.value)} required><option value="">Choisir...</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
              <div className="field" style={{ flex: 1 }}><label>Vers</label><select value={toWarehouse} onChange={(e) => setToWarehouse(e.target.value)} required><option value="">Choisir...</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
            </div>
            <div className="field"><label>Produit</label><select value={transferProduct} onChange={(e) => setTransferProduct(e.target.value)} required><option value="">Choisir...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label>Quantité</label><input type="number" min="1" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} required /></div>
            {transferError && <div className="error-text">{transferError}</div>}
            <button className="btn block" disabled={transferSubmitting} type="submit">{transferSubmitting ? "Transfert..." : "Transférer"}</button>
          </form>
        </div>
      </div>
      {inventory === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
      {inventory?.length === 0 && <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Aucune ligne de stock.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {inventory?.map((row) => (
          <div key={row.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontWeight: 600 }}>{row.product_name}</div><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{row.warehouse_name}</div></div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, color: row.quantity <= row.min_threshold ? "var(--red)" : "var(--text-primary)" }}>{row.quantity} unités</div>
              {row.quantity <= row.min_threshold && <div style={{ fontSize: 11, color: "var(--red)" }}>Stock faible (seuil : {row.min_threshold})</div>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
