import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShopPro — Plateforme SaaS commerce & livraison",
  description: "Vendez, gérez et livrez — tout en un seul endroit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
