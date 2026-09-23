"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(extractErrorMessage(data.error));
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
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Créer un compte</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 22 }}>
          Rejoignez ShopPro en tant que client ou entreprise
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nom complet</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn block" disabled={loading} type="submit">
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </form>
        <div className="muted-link">
          Déjà un compte ? <Link href="/login">Se connecter</Link>
        </div>
      </div>
    </main>
  );
}
