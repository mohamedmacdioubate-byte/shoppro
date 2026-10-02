"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Company = { id: string; name: string; role_name: string; is_director: boolean; status: string };
type MarketCompany = { id: string; name: string; sector: string | null; city: string | null; average_rating: string | null; review_count: string };
type MarketProduct = { id: string; name: string; base_price: string; company_id: string; company_name: string };

export default function DashboardPage() {
  const router = useRouter();
  const [myCompanies, setMyCompanies] = useState<Company[] | null>(null);
  const [isFounder, setIsFounder] = useState(false);
  const [isDriver, setIsDriver] = useState(false);

  const [tab, setTab] = useState<"entreprises" | "produits">("entreprises");

  const [companyQuery, setCompanyQuery] = useState("");
  const [market, setMarket] = useState<MarketCompany[] | null>(null);

  const [productQuery, setProductQuery] = useState("");
  const [products, setProducts] = useState<MarketProduct[] | null>(null);

  const [error, setError] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");

  const loadCompanies = useCallback(async (q: string) => {
    const res = await fetch(`/api/shop/companies${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const data = await res.json();
    setMarket(data.companies ?? []);
  }, []);

  const loadProducts = useCallback(async (q: string) => {
    if (!q) { setProducts([]); return; }
    const res = await fetch(`/api/shop/products/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const data = await res.json();
    setProducts(data.products ?? []);
  }, []);

  useEffect(() => {
    const t = token();
    if (!t) { router.push("/login"); return; }

    fetch("/api/companies", { headers: { Authorization: `Bearer ${t}` } })
      .then(async (res) => {
        if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
        const data = await res.json();
        setMyCompanies(data.companies ?? []);
      })
      .catch(() => setError("Impossible de charger vos entreprises"));

    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json()).then((d) => setIsFounder(Boolean(d.user?.is_founder))).catch(() => {});

    fetch("/api/drivers", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json()).then((d) => setIsDriver(Boolean(d.driver))).catch(() => {});

    loadCompanies("").catch(() => setError("Impossible de charger les entreprises"));
  }, [router, loadCompanies]);

  function logout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div className="serif" style={{ fontSize: 22, fontWeight: 700 }}>ShopPro</div>
        <div style={{ display: "flex", gap: 10 }}>
          {isFounder && (
            <Link href="/founder" className="btn" style={{ color: "var(--ink)", background: "var(--gold)" }}>👑 Fondateur</Link>
          )}
          <Link href="/notifications" className="btn" style={{ color: "var(--text-primary)", background: "var(--bg-panel)", border: "1px solid var(--border-light)" }}>🔔</Link>
          <button className="btn" onClick={logout} style={{ color: "var(--text-primary)", background: "var(--bg-panel)", border: "1px solid var(--border-light)" }}>Déconnexion</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, fontSize: 12.5 }}>
        <Link href="/invoices" style={{ color: "var(--amberD)", fontWeight: 600 }}>🧾 Mes factures</Link>
      </div>

      {error && <div className="error-text">{error}</div>}

      {/* Onglets — chaque recherche reste dans sa propre catégorie */}
      <div className="tabs">
        <button className={`tab ${tab === "entreprises" ? "active" : ""}`} onClick={() => setTab("entreprises")}>
          Entreprises
        </button>
        <button className={`tab ${tab === "produits" ? "active" : ""}`} onClick={() => setTab("produits")}>
          Produits
        </button>
      </div>

      {tab === "entreprises" && (
        <>
          <div className="field" style={{ marginBottom: 16 }}>
            <input
              placeholder="Rechercher une entreprise (nom, secteur, ville)..."
              value={companyQuery}
              onChange={(e) => { setCompanyQuery(e.target.value); loadCompanies(e.target.value); }}
            />
          </div>

          {market === null && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
          {market?.length === 0 && (
            <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: 28 }}>
              Aucune entreprise ne correspond à votre recherche.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
            {market?.map((c) => (
              <Link key={c.id} href={`/shop/${c.id}`} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {c.sector || "Secteur non précisé"} {c.city ? `· ${c.city}` : ""}
                  </div>
                </div>
                {c.average_rating && (
                  <div style={{ fontSize: 12.5, color: "var(--gold)" }}>★ {c.average_rating} <span style={{ color: "var(--text-muted)" }}>({c.review_count})</span></div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {tab === "produits" && (
        <>
          <div className="field" style={{ marginBottom: 16 }}>
            <input
              placeholder="Rechercher un produit..."
              value={productQuery}
              onChange={(e) => { setProductQuery(e.target.value); loadProducts(e.target.value); }}
            />
          </div>

          {productQuery && products === null && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
          {productQuery && products?.length === 0 && (
            <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: 28 }}>
              Aucun produit ne correspond à votre recherche.
            </div>
          )}
          {!productQuery && (
            <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: 28 }}>
              Tapez le nom d&apos;un produit pour le chercher dans toutes les entreprises.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
            {products?.map((p) => (
              <Link key={p.id} href={`/shop/${p.company_id}`} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.company_name}</div>
                </div>
                <div style={{ fontWeight: 700 }}>{Number(p.base_price).toLocaleString("fr-FR")} GNF</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Section entreprise(s) — seulement si le compte en gère au moins une */}
      {myCompanies !== null && myCompanies.length > 0 && (
        <>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Vos entreprises</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {myCompanies.map((c) => (
              <Link key={c.id} href={`/companies/${c.id}`} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.role_name}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
                  background: c.status === "active" ? "var(--green-dim)" : "var(--blue-dim)",
                  color: c.status === "active" ? "var(--green)" : "var(--amberD)",
                }}>
                  {c.status}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Section livreur — seulement si un profil livreur existe */}
      {isDriver && (
        <>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Livraison</div>
          <Link href="/driver" className="panel" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            🚚 <span style={{ fontWeight: 600 }}>Mes livraisons</span>
          </Link>
        </>
      )}

      {/* Discret, pas mis en avant : ouvrir un compte pro ou devenir livreur */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, display: "flex", gap: 16, fontSize: 12.5 }}>
        <Link href="/companies/new" style={{ color: "var(--text-secondary)" }}>Vous êtes une entreprise ? Créer un compte professionnel →</Link>
      </div>
      {!isDriver && (
        <div style={{ fontSize: 12.5, marginTop: 8 }}>
          <Link href="/drivers/apply" style={{ color: "var(--text-secondary)" }}>Vous êtes livreur ? Postuler →</Link>
        </div>
      )}
    </main>
  );
}
