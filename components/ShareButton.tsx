"use client";

import { useState } from "react";

// Bouton réutilisable : copie le lien de la page actuelle (ou une URL
// donnée) dans le presse-papier, avec un retour visuel bref.
export default function ShareButton({ url, label = "Partager" }: { url?: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const link = url ?? window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // presse-papier indisponible (permissions navigateur) — pas bloquant
    }
  }

  return (
    <button
      onClick={copy}
      className="btn"
      style={{ color: "var(--text-primary)", background: "var(--bg-panel)", border: "1px solid var(--border-light)", padding: "7px 14px", fontSize: 12.5 }}
    >
      {copied ? "✓ Lien copié" : `🔗 ${label}`}
    </button>
  );
}
