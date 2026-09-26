"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(extractErrorMessage(data.error));
        return;
      }
      if (data.requiresTwoFactor) {
        setError("Vérification en deux étapes requise (à implémenter côté Fondateur).");
        return;
      }
      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="panel" style={{ width: 380 }}>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Connexion</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 22 }}>
          Accédez à votre espace ShopPro
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email ou téléphone</label>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn block" disabled={loading} type="submit">
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
        <div className="muted-link">
          Pas encore de compte ? <Link href="/register">Créer un compte</Link>
        </div>
      </div>
    </main>
  );
}
