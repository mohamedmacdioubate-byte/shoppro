import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ background: "var(--ink)", color: "#fff", minHeight: "100vh" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div className="serif" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 19 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 34, height: 34, borderRadius: 9, background: "var(--ink)",
            boxShadow: "0 4px 14px -4px rgba(91,79,224,.6)", border: "1px solid rgba(255,255,255,.1)",
          }}>🛍️</span>
          Shop<em>Pro</em>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/login" style={{ fontSize: 13.5, fontWeight: 600, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", padding: "9px 18px", borderRadius: 7, color: "#fff" }}>
            Se connecter
          </Link>
        </div>
      </nav>

      <div style={{ textAlign: "center", padding: "90px 24px 70px" }}>
        <span className="eyebrow" style={{
          display: "inline-block", background: "rgba(91,79,224,.15)", border: "1px solid rgba(91,79,224,.3)",
          padding: "6px 14px", borderRadius: 20, marginBottom: 26, color: "var(--amber)",
        }}>
          🚀 Plateforme SaaS commerce &amp; livraison
        </span>
        <h1 className="serif" style={{ fontSize: "clamp(34px,6vw,64px)", fontWeight: 700, lineHeight: 1.08, maxWidth: 760, margin: "0 auto 20px" }}>
          Vendez, gérez et livrez —<br /><em>tout en un seul endroit</em>
        </h1>
        <p style={{ fontSize: "clamp(15px,2vw,18px)", color: "#9aa0ab", maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.6 }}>
          Catalogue, stock multi-dépôts, commandes, livreurs, promotions et
          facturation — pour tous les secteurs, toutes les tailles d&apos;entreprise.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" className="btn" style={{ padding: "14px 28px", fontSize: 15, borderRadius: 8 }}>
            Créer un compte
          </Link>
          <Link href="/login" style={{
            fontWeight: 600, fontSize: 15, padding: "14px 28px", borderRadius: 8,
            background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", color: "#fff",
          }}>
            Se connecter
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 90px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {[
          { icon: "🏪", title: "Multi-tenant", text: "Chaque entreprise a son espace isolé — produits, stock, clients, jamais partagés." },
          { icon: "📦", title: "Stock multi-dépôts", text: "Suivi en temps réel, transferts entre dépôts, alertes de seuil." },
          { icon: "🚚", title: "Livreurs intégrés", text: "Candidatures, affectation, suivi de statut jusqu'à la livraison." },
          { icon: "🏷️", title: "Promotions & fidélité", text: "Codes promo validés côté serveur, points fidélité automatiques." },
          { icon: "🧾", title: "Facturation auto", text: "Une facture générée à chaque commande, consultable à tout moment." },
          { icon: "👑", title: "Espace Fondateur", text: "Validation des entreprises, suivi global, avis sur la plateforme." },
        ].map((f) => (
          <div key={f.title} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, padding: 24 }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
            <div className="serif" style={{ fontSize: 16, marginBottom: 6, fontWeight: 600 }}>{f.title}</div>
            <p style={{ fontSize: 13, color: "#9aa0ab", lineHeight: 1.6 }}>{f.text}</p>
          </div>
        ))}
      </div>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,.08)", padding: "24px 32px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#5a626e" }}>ShopPro — commerce, gestion et livraison en une seule plateforme.</p>
      </footer>
    </div>
  );
}
