"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Notification = {
  id: string; type: string; title: string; body: string | null; read_at: string | null; created_at: string;
};

const ICONS: Record<string, string> = {
  nouvelle_commande: "🛒",
  paiement: "💵",
  livraison: "🚚",
  stock_faible: "⚠️",
  nouvelle_candidature: "👤",
  nouveau_message: "💬",
  nouvelle_promotion: "🏷️",
  abonnement: "📅",
  expiration_essai: "⏰",
  suspension: "⛔",
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }
    const res = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    const data = await res.json();
    setNotifications(data.notifications ?? []);
  }, [router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger les notifications")); }, [load]);

  async function markRead(id?: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(id ? { id } : {}),
    });
    await load();
  }

  const unreadCount = notifications?.filter((n) => !n.read_at).length ?? 0;

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>🔔 Notifications</div>
        {unreadCount > 0 && (
          <button className="btn" style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", fontSize: 12, padding: "6px 12px" }} onClick={() => markRead()}>
            Tout marquer comme lu
          </button>
        )}
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est lu"}
      </div>

      {error && <div className="error-text">{error}</div>}
      {notifications === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
      {notifications?.length === 0 && (
        <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Aucune notification.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notifications?.map((n) => (
          <div
            key={n.id}
            className="panel"
            onClick={() => !n.read_at && markRead(n.id)}
            style={{ display: "flex", gap: 12, cursor: n.read_at ? "default" : "pointer", opacity: n.read_at ? 0.6 : 1, borderColor: n.read_at ? "var(--border)" : "var(--blue)" }}
          >
            <div style={{ fontSize: 20 }}>{ICONS[n.type] ?? "🔔"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{n.body}</div>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
