import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="container" style={{ textAlign: "center", maxWidth: 560 }}>
        <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 14 }}>🛍️ ShopPro</div>
        <p style={{ color: "var(--text-secondary)", fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
          La plateforme SaaS pour vendre, gérer vos stocks, vos livraisons et
          vos équipes — tous secteurs, toutes tailles d&apos;entreprise.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/login" className="btn">Se connecter</Link>
          <Link href="/register" className="btn" style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}>
            Créer un compte
          </Link>
        </div>
      </div>
    </main>
  );
}
